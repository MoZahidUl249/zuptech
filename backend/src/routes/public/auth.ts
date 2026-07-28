import { Elysia } from "elysia";
import {
  claimAccountDto,
  forgotPasswordDto,
  loginCustomerDto,
  registerCustomerDto,
  resetPasswordDto,
} from "../../dtos/auth.dto";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/db";
import { ApiError, badRequest, conflict } from "../../lib/http";
import { allowHit, clientIp } from "../../lib/rate-limit";
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
      const email = body.email.trim().toLowerCase();

      const ip = clientIp(request, server);
      if (!allowHit(`register-ip:${ip}`, 10, 5 * 60_000)) {
        throw new ApiError(429, "Too many attempts — try again in a few minutes");
      }

      // Checked before the auth user is created so a collision doesn't leave
      // an orphan account behind. Customer.email is unique because it's the
      // lookup key for password reset — two accounts sharing one address
      // would make "which account is this code for?" unanswerable.
      const emailTaken = await prisma.customer.findFirst({
        where: { email, phone: { not: phone } },
        select: { id: true },
      });
      if (emailTaken) throw conflict("That email address is already registered");

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
        // that Customer row in sync with the details given at registration.
        await prisma.customer.upsert({
          where: { phone },
          create: { phone, name: body.name.trim(), email },
          update: { name: body.name.trim(), email },
        });
      }

      return response;
    },
    { body: registerCustomerDto },
  )

  /**
   * Turn a guest-checkout row into a real account, offered on the order
   * success screen. Same end state as /register, minus the name/phone the
   * customer just typed at checkout.
   *
   * Only valid when the phone has a Customer row but no sign-in account —
   * i.e. exactly a guest who has ordered. That narrowness is what keeps it
   * safe: it can never take over an account that already has a password, and
   * it can't be used to probe for numbers that do (both the "no orders" and
   * "already registered" cases answer the same way).
   */
  .post(
    "/api/auth/claim",
    async ({ body, request, server }) => {
      const phone = normalizePhone(body.phone);
      if (!isValidPhone(phone)) throw badRequest("Phone must match 01XXXXXXXXX");
      const email = body.email?.trim().toLowerCase() || null;

      const ip = clientIp(request, server);
      if (
        !allowHit(`claim:${phone}`, 5, 5 * 60_000) ||
        !allowHit(`claim-ip:${ip}`, 10, 5 * 60_000)
      ) {
        throw new ApiError(429, "Too many attempts — try again in a few minutes");
      }

      const customer = await prisma.customer.findUnique({
        where: { phone },
        select: { id: true, name: true },
      });
      const existingUser = await prisma.user.findUnique({
        where: { phoneNumber: phone },
        select: { id: true },
      });

      // Deliberately one message for both "never ordered" and "already has a
      // password": distinguishing them would turn this into a way to ask
      // whether a given number is a customer.
      if (!customer || existingUser) {
        throw badRequest(
          "We can't set a password for that number here — try signing in, or register instead.",
        );
      }

      // Same uniqueness rule as /register: Customer.email is the lookup key
      // for password reset, so two accounts can't share one address.
      if (email) {
        const emailTaken = await prisma.customer.findFirst({
          where: { email, phone: { not: phone } },
          select: { id: true },
        });
        if (emailTaken) throw conflict("That email address is already registered");
      }

      const response = await auth.api.signUpEmail({
        body: {
          email: customerEmail(phone),
          password: body.password,
          name: customer.name,
          phoneNumber: phone,
        },
        headers: request.headers,
        asResponse: true,
      });

      // Only attach the real inbox once the account exists — a failed sign-up
      // shouldn't leave a reset address pointing at a passwordless row.
      if (response.ok && email) {
        await prisma.customer.update({ where: { id: customer.id }, data: { email } });
      }

      return response;
    },
    { body: claimAccountDto },
  )

  .post(
    "/api/auth/login",
    async ({ body, request, server }) => {
      const phone = normalizePhone(body.phone);
      if (!isValidPhone(phone)) throw badRequest("Phone must match 01XXXXXXXXX");

      const ip = clientIp(request, server);
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

  /**
   * Send a reset code to a customer's email. Always 200 with `{ok:true}`,
   * whether or not the address belongs to an account — the response must not
   * become an account-existence oracle. The code only ever travels by email;
   * it is never echoed in a response body.
   */
  .post(
    "/api/auth/forgot-password",
    async ({ body, request, server }) => {
      const email = body.email.trim().toLowerCase();

      const ip = clientIp(request, server);
      if (
        !allowHit(`forgot:${email}`, 3, 5 * 60_000) ||
        !allowHit(`forgot-ip:${ip}`, 10, 5 * 60_000)
      ) {
        throw new ApiError(429, "Too many attempts — try again in a few minutes");
      }

      const customer = await prisma.customer.findUnique({
        where: { email },
        select: { phone: true },
      });
      if (customer) {
        // Better Auth's email-otp plugin generates + stores the code and calls
        // sendVerificationOTP (lib/auth.ts), which resolves this synthetic
        // address back to the customer's real inbox. It silently no-ops for a
        // phone with no auth account behind it (guest checkout).
        await auth.api.requestPasswordResetEmailOTP({
          body: { email: customerEmail(customer.phone) },
        });
      }

      return { ok: true };
    },
    { body: forgotPasswordDto },
  )

  .post(
    "/api/auth/reset-password",
    async ({ body, request, server }) => {
      const email = body.email.trim().toLowerCase();

      const ip = clientIp(request, server);
      if (
        !allowHit(`reset-ip:${ip}`, 10, 5 * 60_000) ||
        !allowHit(`reset:${email}`, 5, 5 * 60_000)
      ) {
        throw new ApiError(429, "Too many attempts — try again in a few minutes");
      }

      const customer = await prisma.customer.findUnique({
        where: { email },
        select: { phone: true },
      });
      // Same wording as an invalid code: whether the address exists and
      // whether the code was wrong are not worth distinguishing to an attacker.
      if (!customer) throw badRequest("That code is invalid or has expired");

      // Verifies + consumes the OTP and updates the credential account
      // atomically; asResponse forwards Better Auth's own error status for
      // an invalid/expired/too-many-attempts code.
      return auth.api.resetPasswordEmailOTP({
        body: { email: customerEmail(customer.phone), otp: body.otp, password: body.password },
        asResponse: true,
      });
    },
    { body: resetPasswordDto },
  )

  /** Sign out (customers). Staff use POST /admin/api/logout. */
  .post("/api/auth/logout", async ({ request }) =>
    auth.api.signOut({ headers: request.headers, asResponse: true }),
  );
