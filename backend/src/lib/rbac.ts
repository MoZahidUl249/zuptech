import { auth } from "./auth";
import { prisma } from "./db";
import { forbidden } from "./http";

/**
 * Role-based access control for the admin panel. Every admin request is
 * checked server-side (BACKEND.md §6) — the client-side gate is cosmetic.
 */

/**
 * Must stay in step with ADMIN_MODULES in ../fronend/lib/admin.tsx — the admin
 * UI sends the whole permission matrix when saving a role, and validateModules
 * (routes/admin/staff.ts) 400s on any key this list doesn't know.
 *
 * A module earns its place here by being checked on a route. Anything listed
 * but never passed to assertCan is worse than nothing: the role editor offers
 * it, an admin sets it to "none" believing they've withheld something, and no
 * request is refused. (`pricing` was exactly that and has been removed;
 * delivery/installation fees are per-product and live under `products`.)
 */
export const ADMIN_MODULES = [
  "dashboard",
  "analytics",
  "orders",
  "invoices",
  "warranty",
  "products",
  "inventory",
  "leads",
  "customers",
  "homepage",
  "landingpages",
  "sitecontent",
  "payments",
  /* Booking a parcel, assigning a rider, and configuring couriers. Separate
     from `orders` because handing a customer's name, phone and address to a
     third-party courier is a different act from advancing a status — and
     because courier credentials live behind it, exactly as gateway
     credentials live behind `payments`. */
  "shipping",
  "staff",
  /* Correcting an order's delivery zone or its charges after it was placed.
     Separate from `orders` on purpose: all three seeded roles hold
     `orders: manage` — including Support — and moving money on a placed order
     is a different kind of act from advancing its status. Nobody holds this
     until a Super Admin grants it, which is the safe default for the one
     permission that lets a human overwrite a computed total. */
  "orderadjust",
] as const;

export type AdminModule = (typeof ADMIN_MODULES)[number];
export type Permission = "none" | "view" | "manage";
export type PermissionMatrix = Record<AdminModule, Permission>;

export interface StaffContext {
  staff: { id: string; name: string; username: string; phone: string; email: string };
  role: { id: string; name: string; isSystem: boolean };
  permissions: PermissionMatrix;
}

/**
 * Resolve the staff member behind a request's session cookie.
 * Returns null for anonymous requests AND for customer sessions — holding a
 * session is not enough to touch /admin/api, you must have a Staff row.
 */
export async function getStaffContext(headers: Headers): Promise<StaffContext | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;

  const staff = await prisma.staff.findUnique({
    where: { userId: session.user.id },
    include: { role: true },
  });
  if (!staff) return null;

  return {
    staff: {
      id: staff.id,
      name: staff.name,
      username: staff.username,
      phone: staff.phone,
      email: staff.email ?? "",
    },
    role: { id: staff.role.id, name: staff.role.name, isSystem: staff.role.isSystem },
    permissions: normalizePermissions(staff.role.permissions),
  };
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Coerce the stored JSON into a full matrix — unknown/missing ⇒ "none". */
export function normalizePermissions(raw: unknown): PermissionMatrix {
  const source = isJsonObject(raw) ? raw : {};
  // Spelled out (not looped into an empty object) so the compiler proves the
  // matrix is complete when a module is added to ADMIN_MODULES.
  const matrix: PermissionMatrix = {
    dashboard: "none",
    analytics: "none",
    orders: "none",
    invoices: "none",
    warranty: "none",
    products: "none",
    inventory: "none",
    leads: "none",
    customers: "none",
    homepage: "none",
    landingpages: "none",
    sitecontent: "none",
    payments: "none",
    shipping: "none",
    staff: "none",
    orderadjust: "none",
  };
  for (const module of ADMIN_MODULES) {
    const value = source[module];
    if (value === "manage" || value === "view") matrix[module] = value;
  }
  return matrix;
}

/**
 * Throw 403 unless the staff member has the required access level.
 * "view" is satisfied by view or manage; "manage" requires manage.
 */
export function assertCan(ctx: StaffContext, module: AdminModule, level: "view" | "manage") {
  const have = ctx.permissions[module];
  const ok = level === "view" ? have !== "none" : have === "manage";
  if (!ok) throw forbidden(`Your role (${ctx.role.name}) lacks ${level} access to ${module}`);
}

/**
 * Throw 403 unless the staff member has the required access to at least one of
 * `modules`. For an endpoint that genuinely backs more than one screen —
 * /admin/api/metrics feeds both Today and Reports — checking a single module
 * would lock out a role that legitimately has the other one.
 */
export function assertCanAny(
  ctx: StaffContext,
  modules: AdminModule[],
  level: "view" | "manage",
) {
  const ok = modules.some((module) => {
    const have = ctx.permissions[module];
    return level === "view" ? have !== "none" : have === "manage";
  });
  if (!ok) {
    throw forbidden(
      `Your role (${ctx.role.name}) lacks ${level} access to ${modules.join(" or ")}`,
    );
  }
}

/** Ordering used to compare two permission levels. */
const RANK: Record<Permission, number> = { none: 0, view: 1, manage: 2 };

/**
 * Throw 403 if `permissions` would grant more access than the caller holds.
 *
 * Without this, `staff: manage` is the only permission anyone needs: create a
 * role with every module set to "manage", assign it to yourself, and you are
 * Super Admin under another name. Holders of the system role are exempt —
 * they already have everything, so there is nothing for them to escalate to.
 */
export function assertCanGrant(ctx: StaffContext, permissions: Partial<PermissionMatrix>) {
  if (ctx.role.isSystem) return;

  const tooHigh = ADMIN_MODULES.filter((module) => {
    const wanted = permissions[module];
    return wanted !== undefined && RANK[wanted] > RANK[ctx.permissions[module]];
  });

  if (tooHigh.length > 0) {
    throw forbidden(
      `You can't grant access you don't have yourself: ${tooHigh.join(", ")}`,
    );
  }
}
