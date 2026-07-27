import { Elysia } from "elysia";
import { unauthorized } from "../../lib/http";
import { getStaffContext } from "../../lib/rbac";

/**
 * Session guard shared by every admin sub-router: resolves the staff member
 * behind the request's cookie and rejects anonymous/customer sessions with
 * 401. Per-module permission checks stay in the handlers via `assertCan` —
 * that keeps "which permission does this route need" visible right where the
 * work happens.
 *
 * `as: "scoped"` lifts the derive into whichever router `.use()`s this plugin.
 */
export const staffGuard = new Elysia({ name: "admin/staff-guard" }).derive(
  { as: "scoped" },
  async ({ request }) => {
    const staffCtx = await getStaffContext(request.headers);
    if (!staffCtx) throw unauthorized("Staff sign-in required");
    return { staffCtx };
  },
);
