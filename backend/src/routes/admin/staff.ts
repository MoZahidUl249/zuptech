import { Elysia } from "elysia";
import {
  createRoleDto,
  createStaffDto,
  type PermissionsDto,
  updateRoleDto,
  updateStaffDto,
} from "../../dtos/staff.dto";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/db";
import { badRequest, conflict, forbidden, notFound } from "../../lib/http";
import { ADMIN_MODULES, assertCan, assertCanGrant, normalizePermissions } from "../../lib/rbac";
import { isOneOf, staffEmail } from "../../lib/rules";
import { staffGuard } from "./guard";

/**
 * Staff & role management, enforcing the invariants from BACKEND.md §2:
 *  - the Super Admin role (isSystem) can't be edited or deleted
 *  - a staff member can't remove themselves
 *  - roles that still have staff can't be deleted
 *  - usernames are unique (Better Auth + DB constraint)
 * Credentials live in Better Auth; this module keeps the Staff profile row
 * and the auth user in lockstep.
 *
 * Three further rules exist because `staff: manage` would otherwise be a
 * complete bypass of every other permission in the matrix:
 *  - you can't edit a Super Admin unless you are one (their password is a
 *    session away from being everyone else's permissions)
 *  - you can't change your OWN role (pair it with the rule below and role
 *    assignment becomes self-service escalation)
 *  - you can't put access into a role that you don't hold yourself
 *    (`assertCanGrant`), so "make a role with everything on" is closed too
 * Together these are what make `isSystem` mean something. Protecting the
 * system ROLE row alone never did — an equivalent role could just be built
 * beside it.
 */

function serializeRole(role: {
  id: string;
  name: string;
  permissions: unknown;
  isSystem: boolean;
  _count?: { staff: number };
}) {
  return {
    id: role.id,
    name: role.name,
    permissions: normalizePermissions(role.permissions),
    isSystem: role.isSystem,
    staffCount: role._count?.staff ?? 0,
  };
}

/** Reject permission objects that mention modules we don't have. */
function validateModules(permissions: PermissionsDto) {
  const unknown = Object.keys(permissions).filter((key) => !isOneOf(ADMIN_MODULES, key));
  if (unknown.length > 0) throw badRequest(`Unknown modules: ${unknown.join(", ")}`);
}

export const adminStaff = new Elysia({ name: "routes/admin/staff", detail: { tags: ["Admin · Staff"] } })
  .use(staffGuard)

  /* ===== Staff ===== */

  .get("/admin/api/staff", async ({ staffCtx }) => {
    assertCan(staffCtx, "staff", "view");
    const staff = await prisma.staff.findMany({ orderBy: { name: "asc" } });
    return staff.map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      email: s.email ?? "",
      username: s.username,
      roleId: s.roleId,
    }));
  })

  .post(
    "/admin/api/staff",
    async ({ body, staffCtx, set }) => {
      assertCan(staffCtx, "staff", "manage");

      const username = body.username.trim().toLowerCase();
      const email = body.email?.trim().toLowerCase() || null;
      const role = await prisma.role.findUnique({ where: { id: body.roleId } });
      if (!role) throw notFound("Role");
      // Creating an account stronger than your own is the same escalation as
      // promoting yourself into one, with an extra step.
      assertCanGrant(staffCtx, normalizePermissions(role.permissions));
      if (await prisma.staff.findUnique({ where: { username } })) {
        throw conflict(`Username "${username}" is taken`);
      }
      // Unique because it's the password-reset lookup key.
      if (email && (await prisma.staff.findUnique({ where: { email } }))) {
        throw conflict(`Email "${email}" is already assigned to another staff member`);
      }

      // Better Auth owns the credentials; the synthetic email is never mailed.
      // `email` above is the real inbox reset codes are delivered to.
      const signup = await auth.api.signUpEmail({
        body: {
          email: staffEmail(username),
          password: body.password,
          name: body.name.trim(),
          username,
        },
      });

      // signUpEmail and this insert are two different systems, so this can't
      // be one atomic transaction — if the Staff row write fails, compensate
      // by removing the auth user we just created instead of leaving an
      // orphaned account (unmanageable via this API, but still holding the
      // username) behind.
      let staff;
      try {
        staff = await prisma.staff.create({
          data: {
            name: body.name.trim(),
            phone: body.phone?.trim() ?? "",
            email,
            username,
            roleId: role.id,
            userId: signup.user.id,
          },
        });
      } catch (err) {
        await prisma.user.delete({ where: { id: signup.user.id } }).catch(() => {});
        throw err;
      }

      set.status = 201;
      return {
        id: staff.id,
        name: staff.name,
        phone: staff.phone,
        email: staff.email ?? "",
        username,
        roleId: role.id,
      };
    },
    { body: createStaffDto },
  )

  .patch(
    "/admin/api/staff/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "staff", "manage");

      const existing = await prisma.staff.findUnique({
        where: { id: params.id },
        include: { role: true },
      });
      if (!existing) throw notFound("Staff member");

      // Resetting a Super Admin's password hands over their session, and with
      // it every permission in the matrix. Only another Super Admin may.
      if (existing.role.isSystem && !staffCtx.role.isSystem) {
        throw forbidden("Only a Super Admin can edit a Super Admin account");
      }

      // Changing your own role is self-service escalation: pick the role with
      // the most access and assign it to yourself. Someone else does it for you.
      if (body.roleId && params.id === staffCtx.staff.id) {
        throw conflict("You can't change your own role — ask another admin");
      }

      if (body.roleId) {
        const role = await prisma.role.findUnique({ where: { id: body.roleId } });
        if (!role) throw notFound("Role");
        // A non-system admin can't hand out a role stronger than their own.
        assertCanGrant(staffCtx, normalizePermissions(role.permissions));
      }

      const email = body.email === undefined ? undefined : body.email.trim().toLowerCase() || null;
      if (email) {
        const clash = await prisma.staff.findUnique({ where: { email } });
        if (clash && clash.id !== existing.id) {
          throw conflict(`Email "${email}" is already assigned to another staff member`);
        }
      }

      // Password changes go through Better Auth's hasher — never store raw.
      if (body.password) {
        const ctx = await auth.$context;
        const hash = await ctx.password.hash(body.password);
        await ctx.internalAdapter.updatePassword(existing.userId, hash);
      }

      const staff = await prisma.staff.update({
        where: { id: params.id },
        data: {
          ...(body.name ? { name: body.name.trim() } : {}),
          ...(body.phone !== undefined ? { phone: body.phone.trim() } : {}),
          ...(email !== undefined ? { email } : {}),
          ...(body.roleId ? { roleId: body.roleId } : {}),
        },
      });
      return {
        id: staff.id,
        name: staff.name,
        phone: staff.phone,
        email: staff.email ?? "",
        username: staff.username,
        roleId: staff.roleId,
      };
    },
    { body: updateStaffDto },
  )

  .delete("/admin/api/staff/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "staff", "manage");

    // Locking yourself out is always a mistake — block it (§2).
    if (params.id === staffCtx.staff.id) throw conflict("You can't remove your own account");

    const existing = await prisma.staff.findUnique({
      where: { id: params.id },
      include: { role: true },
    });
    if (!existing) throw notFound("Staff member");

    // Same rule as editing one: a manager removing the Super Admins is how an
    // account takeover gets locked in.
    if (existing.role.isSystem && !staffCtx.role.isSystem) {
      throw forbidden("Only a Super Admin can remove a Super Admin account");
    }

    // Deleting the auth user cascades to sessions, accounts and the Staff row.
    await prisma.user.delete({ where: { id: existing.userId } });
    return { ok: true };
  })

  /* ===== Roles ===== */

  .get("/admin/api/roles", async ({ staffCtx }) => {
    assertCan(staffCtx, "staff", "view");
    const roles = await prisma.role.findMany({
      include: { _count: { select: { staff: true } } },
      orderBy: { name: "asc" },
    });
    return roles.map(serializeRole);
  })

  .post(
    "/admin/api/roles",
    async ({ body, staffCtx, set }) => {
      assertCan(staffCtx, "staff", "manage");
      validateModules(body.permissions);
      assertCanGrant(staffCtx, normalizePermissions(body.permissions));

      const id = body.name.trim().toLowerCase().replace(/\s+/g, "-");
      const clash = await prisma.role.findFirst({
        where: { OR: [{ id }, { name: body.name.trim() }] },
      });
      if (clash) throw conflict(`Role "${body.name}" already exists`);

      const role = await prisma.role.create({
        data: { id, name: body.name.trim(), permissions: normalizePermissions(body.permissions) },
      });
      set.status = 201;
      return serializeRole(role);
    },
    { body: createRoleDto },
  )

  .patch(
    "/admin/api/roles/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "staff", "manage");

      const existing = await prisma.role.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Role");
      if (existing.isSystem) throw conflict("The Super Admin role can't be edited");
      if (body.permissions) {
        validateModules(body.permissions);
        // Both the role as it will be AND as it is today: you can't raise a
        // role above yourself, and you can't seize one that already is.
        assertCanGrant(staffCtx, normalizePermissions(body.permissions));
        assertCanGrant(staffCtx, normalizePermissions(existing.permissions));
      }

      const role = await prisma.role.update({
        where: { id: params.id },
        data: {
          ...(body.name ? { name: body.name.trim() } : {}),
          ...(body.permissions ? { permissions: normalizePermissions(body.permissions) } : {}),
        },
      });
      return serializeRole(role);
    },
    { body: updateRoleDto },
  )

  .delete("/admin/api/roles/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "staff", "manage");

    const existing = await prisma.role.findUnique({
      where: { id: params.id },
      include: { _count: { select: { staff: true } } },
    });
    if (!existing) throw notFound("Role");
    if (existing.isSystem) throw conflict("The Super Admin role can't be deleted");
    if (existing._count.staff > 0) {
      throw conflict(`${existing._count.staff} staff member(s) still use this role`);
    }

    await prisma.role.delete({ where: { id: params.id } });
    return { ok: true };
  });
