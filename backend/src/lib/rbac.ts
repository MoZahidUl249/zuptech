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
  "pricing",
  "staff",
] as const;

export type AdminModule = (typeof ADMIN_MODULES)[number];
export type Permission = "none" | "view" | "manage";
export type PermissionMatrix = Record<AdminModule, Permission>;

export interface StaffContext {
  staff: { id: string; name: string; username: string; phone: string };
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
    staff: { id: staff.id, name: staff.name, username: staff.username, phone: staff.phone },
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
    pricing: "none",
    staff: "none",
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
