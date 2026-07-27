import { Elysia } from "elysia";
import {
  forgotPasswordDto,
  loginCustomerDto,
  registerCustomerDto,
  resetPasswordDto,
} from "../../dtos/auth.dto";
import { auth, devResetStore } from "../../lib/auth";
import { prisma } from "../../lib/db";
import { ApiError, badRequest } from "../../lib/http";
import { allowHit } from "../../lib/rate-limit";
import { customerEmail, isValidPhone, normalizePhone } from "../../lib/rules";

/**
 * Customer phone + password login (order tracking). Thin wrappers over
 * Better Auth's email/password flow so the storefront gets phone-shaped
 * paths while phone <-> synthetic email mapping stays hidden in here.
 */
export const customerAuth = new Elysia({ name: "routes/public/auth", detail: { tags: ["Customer auth"] } })
  .post(
    "/api/auth/register",
    async ({ body, request, server }) => {
      const phone = normalizePhone(body.phone);
      if (!isValidPhone(phone)) throw badRequest("Phone must match 01XXXXXXXXX");

      const ip = server?.requestIP(request)?.address ?? "unknown";
      if (!allowHit(`register-ip:${ip}`, 10, 5 * 60_000)) {
        throw new ApiError(429, "Too many attempts — try again in a few minutes");
      }

      // asResponse forwards Better Auth's Set-Cookie (httpOnly session) and
      // its own error status (e.g. duplicate phone) without us duplicating
      // that logic here.
      const response = await auth.api.signUpEmail({
        body: {
          email: customerEmail(phone),
          password: body.password,
          name: body.name.trim(),
          phoneNumber: phone,
        },
        headers: request.headers,
        asResponse: true,
      });

      if (response.ok) {
        // Accounts also auto-create on guest checkout (orders.ts) — keep
        // that Customer row in sync with the name given at registration.
        await prisma.customer.upsert({
          where: { phone },
          create: { phone, name: body.name.trim() },
          update: { name: body.name.trim() },
        });
      }

      return response;
    },
    { body: registerCustomerDto },
  )

  .post(
    "/api/auth/login",
    async ({ body, request, server }) => {
      const phone = normalizePhone(body.phone);
      if (!isValidPhone(phone)) throw badRequest("Phone must match 01XXXXXXXXX");

      const ip = server?.requestIP(request)?.address ?? "unknown";
      if (
        !allowHit(`login:${phone}`, 5, 5 * 60_000) ||
        !allowHit(`login-ip:${ip}`, 20, 5 * 60_000)
      ) {
        throw new ApiError(429, "Too many login attempts — try again in a few minutes");
      }

      return auth.api.signInEmail({
        body: { email: customerEmail(phone), password: body.password },
        headers: request.headers,
        asResponse: true,
      });
    },
    { body: loginCustomerDto },
  )

  .post(
    "/api/auth/forgot-password",
    async ({ body, request, server }) => {
      const phone = normalizePhone(body.phone);
      if (!isValidPhone(phone)) throw badRequest("Phone must match 01XXXXXXXXX");

      const ip = server?.requestIP(request)?.address ?? "unknown";
      if (
        !allowHit(`forgot:${phone}`, 3, 5 * 60_000) ||
        !allowHit(`forgot-ip:${ip}`, 10, 5 * 60_000)
      ) {
        throw new ApiError(429, "Too many attempts — try again in a few minutes");
      }

      // Better Auth's email-otp plugin generates + stores the code and calls
      // sendVerificationOTP (lib/auth.ts), which logs it and — outside
      // production — stashes it in devResetStore. It silently no-ops for an
      // unregistered phone, so this never leaks whether a number exists.
      const email = customerEmail(phone);
      devResetStore.delete(email);
      await auth.api.requestPasswordResetEmailOTP({ body: { email } });

      return {
        ok: true,
        // Convenience while no SMS gateway is connected — never set in production.
        ...(devResetStore.has(email) && { devToken: devResetStore.get(email) }),
      };
    },
    { body: forgotPasswordDto },
  )

  .post(
    "/api/auth/reset-password",
    async ({ body, request, server }) => {
      const phone = normalizePhone(body.phone);
      if (!isValidPhone(phone)) throw badRequest("Phone must match 01XXXXXXXXX");

      const ip = server?.requestIP(request)?.address ?? "unknown";
      if (
        !allowHit(`reset-ip:${ip}`, 10, 5 * 60_000) ||
        !allowHit(`reset:${phone}`, 5, 5 * 60_000)
      ) {
        throw new ApiError(429, "Too many attempts — try again in a few minutes");
      }

      // Verifies + consumes the OTP and updates the credential account
      // atomically; asResponse forwards Better Auth's own error status for
      // an invalid/expired/too-many-attempts code.
      return auth.api.resetPasswordEmailOTP({
        body: { email: customerEmail(phone), otp: body.otp, password: body.password },
        asResponse: true,
      });
    },
    { body: resetPasswordDto },
  )

  /** Sign out (customers). Staff use POST /admin/api/logout. */
  .post("/api/auth/logout", async ({ request }) =>
    auth.api.signOut({ headers: request.headers, asResponse: true }),
  );
