import { Elysia } from "elysia";
import { forgotPasswordDto, resetPasswordDto, staffLoginDto } from "../../dtos/auth.dto";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/db";
import { ApiError, badRequest } from "../../lib/http";
import { allowHit, clientIp } from "../../lib/rate-limit";
import { getStaffContext } from "../../lib/rbac";
import { staffEmail } from "../../lib/rules";

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
        !allowHit(`login:${body.username}`, 5, 5 * 60_000) ||
        !allowHit(`login-ip:${ip}`, 20, 5 * 60_000)
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

  /** Always `{ok:true}` — the response must not reveal whether the address
   *  belongs to a staff account. The code only ever travels by email. */
  .post(
    "/admin/api/forgot-password",
    async ({ body, request, server }) => {
      const email = body.email.trim().toLowerCase();

      const ip = clientIp(request, server);
      if (
        !allowHit(`staff-forgot:${email}`, 3, 5 * 60_000) ||
        !allowHit(`staff-forgot-ip:${ip}`, 10, 5 * 60_000)
      ) {
        throw new ApiError(429, "Too many attempts — try again in a few minutes");
      }

      const staff = await prisma.staff.findUnique({
        where: { email },
        select: { username: true },
      });
      if (staff) {
        await auth.api.requestPasswordResetEmailOTP({
          body: { email: staffEmail(staff.username) },
        });
      }

      return { ok: true };
    },
    { body: forgotPasswordDto },
  )

  .post(
    "/admin/api/reset-password",
    async ({ body, request, server }) => {
      const email = body.email.trim().toLowerCase();

      const ip = clientIp(request, server);
      if (
        !allowHit(`staff-reset:${email}`, 5, 5 * 60_000) ||
        !allowHit(`staff-reset-ip:${ip}`, 10, 5 * 60_000)
      ) {
        throw new ApiError(429, "Too many attempts — try again in a few minutes");
      }

      const staff = await prisma.staff.findUnique({
        where: { email },
        select: { username: true },
      });
      // Same wording as a bad code — an unknown address and a wrong code are
      // not worth distinguishing to an attacker.
      if (!staff) throw badRequest("That code is invalid or has expired");

      return auth.api.resetPasswordEmailOTP({
        body: { email: staffEmail(staff.username), otp: body.otp, password: body.password },
        asResponse: true,
      });
    },
    { body: resetPasswordDto },
  )

  /** The signed-in staff member + their effective permission matrix. */
  .get("/admin/api/me", async ({ request }) => {
    const ctx = await getStaffContext(request.headers);
    if (!ctx) throw new ApiError(401, "Staff sign-in required");
    return ctx;
  });
