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
import { badRequest, conflict, notFound } from "../../lib/http";
import { ADMIN_MODULES, assertCan, normalizePermissions } from "../../lib/rbac";
import { isOneOf } from "../../lib/rules";
import { staffGuard } from "./guard";

/**
 * Staff & role management, enforcing the invariants from BACKEND.md §2:
 *  - the Super Admin role (isSystem) can't be edited or deleted
 *  - a staff member can't remove themselves
 *  - roles that still have staff can't be deleted
 *  - usernames are unique (Better Auth + DB constraint)
 * Credentials live in Better Auth; this module keeps the Staff profile row
 * and the auth user in lockstep.
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
      username: s.username,
      roleId: s.roleId,
    }));
  })

  .post(
    "/admin/api/staff",
    async ({ body, staffCtx, set }) => {
      assertCan(staffCtx, "staff", "manage");

      const username = body.username.trim().toLowerCase();
      const role = await prisma.role.findUnique({ where: { id: body.roleId } });
      if (!role) throw notFound("Role");
      if (await prisma.staff.findUnique({ where: { username } })) {
        throw conflict(`Username "${username}" is taken`);
      }

      // Better Auth owns the credentials; the synthetic email is never mailed.
      const signup = await auth.api.signUpEmail({
        body: {
          email: `${username}@staff.zuptech.local`,
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
      return { id: staff.id, name: staff.name, phone: staff.phone, username, roleId: role.id };
    },
    { body: createStaffDto },
  )

  .patch(
    "/admin/api/staff/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "staff", "manage");

      const existing = await prisma.staff.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Staff member");

      if (body.roleId) {
        const role = await prisma.role.findUnique({ where: { id: body.roleId } });
        if (!role) throw notFound("Role");
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
          ...(body.roleId ? { roleId: body.roleId } : {}),
        },
      });
      return {
        id: staff.id,
        name: staff.name,
        phone: staff.phone,
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

    const existing = await prisma.staff.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound("Staff member");

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
      if (body.permissions) validateModules(body.permissions);

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
