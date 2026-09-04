import { Elysia } from "elysia";
import { staffLoginDto } from "../../dtos/auth.dto";
import { auth } from "../../lib/auth";
import { ApiError } from "../../lib/http";
import { allowHitDurable, clientIp } from "../../lib/rate-limit";
import { getStaffContext } from "../../lib/rbac";

/**
 * Staff authentication. Login/logout wrap Better Auth's username plugin so
 * the panel talks to the paths from BACKEND.md; sessions ride httpOnly
 * cookies set by Better Auth itself (the wrappers just forward the Response).
 *
 * Password reset mirrors the customer flow (routes/public/auth.ts): keyed on
 * the staff member's real `Staff.email`, delivered as a 6-digit code by mail.
 * Staff sign in with a username, so the address is a delivery destination
 * only — a staff member with none still gets their password reset by another
 * admin through PATCH /admin/api/staff/:id.
 */
export const adminAuth = new Elysia({ name: "routes/admin/auth", detail: { tags: ["Admin · Auth"] } })
  .post(
    "/admin/api/login",
    async ({ body, request, server }) => {
      const ip = clientIp(request, server);
      if (
        !(await allowHitDurable(`login:${body.username}`, 5, 5 * 60_000)) ||
        !(await allowHitDurable(`login-ip:${ip}`, 20, 5 * 60_000))
      ) {
        throw new ApiError(429, "Too many login attempts — try again in a few minutes");
      }

      // asResponse keeps Better Auth's Set-Cookie header intact.
      return auth.api.signInUsername({
        body: { username: body.username.trim().toLowerCase(), password: body.password },
        headers: request.headers,
        asResponse: true,
      });
    },
    { body: staffLoginDto },
  )

  .post("/admin/api/logout", async ({ request }) =>
    auth.api.signOut({ headers: request.headers, asResponse: true }),
  )

  /*
   * Staff self-service password reset used to live here — POST
   * /admin/api/forgot-password and /admin/api/reset-password, mailing a code
   * to Staff.email.
   *
   * Removed on purpose. A staff password is a session away from whatever that
   * role can do, and the reset was only ever as strong as the mailbox behind
   * it. A manager sets it instead (POST /admin/api/staff/:id/password), which
   * puts a person who can verify who is asking in the loop.
   *
   * The CUSTOMER flow (routes/public/auth.ts) is untouched — it is keyed on
   * the phone the customer signs in with and is self-service by design.
   */

  /** The signed-in staff member + their effective permission matrix. */
  .get("/admin/api/me", async ({ request }) => {
    const ctx = await getStaffContext(request.headers);
    if (!ctx) throw new ApiError(401, "Staff sign-in required");
    return ctx;
  });
