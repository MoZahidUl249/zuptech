import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP, username } from "better-auth/plugins";
import { prisma } from "./db";

const isProduction = process.env.NODE_ENV === "production";

/**
 * DEV ONLY: the last password-reset OTP issued per (synthetic) customer
 * email, so /api/auth/forgot-password can echo it back while no SMS gateway
 * is wired up. Never populated in production.
 */
export const devResetStore = new Map<string, string>();

/**
 * Better Auth handles both audiences, both via email+password:
 *  - Staff sign in with username + password (`username` plugin).
 *  - Customers sign in with phone + password. Better Auth still requires an
 *    email internally, so callers map each phone to a deterministic
 *    synthetic address (lib/rules.ts `customerEmail`) — it is never emailed.
 * Passwords are hashed by Better Auth (scrypt) — never stored in plaintext.
 * Both audiences get httpOnly session cookies; sessions live in the Session
 * table.
 *
 * Customer password reset uses the official `emailOTP` plugin (6-digit code,
 * 10-minute TTL, 5 attempts, single-use — atomic verify/consume handled by
 * Better Auth itself) rather than a hand-rolled OTP table. routes/public/auth.ts
 * only calls `requestPasswordResetEmailOTP` / `resetPasswordEmailOTP`.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  trustedOrigins: (process.env.CORS_ORIGINS ?? "").split(",").filter(Boolean),

  user: {
    additionalFields: {
      // Customers' real identity; kept as a plain field (not a plugin) now
      // that login is password-based rather than OTP-based.
      phoneNumber: { type: "string", required: false, input: true },
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },

  plugins: [
    username(),

    emailOTP({
      otpLength: 6,
      expiresIn: 600, // 10 minutes
      allowedAttempts: 5,

      // Only the password-reset flow is wired up (routes/public/auth.ts) —
      // sign-in/email-verification/change-email OTPs are never requested.
      // TODO(production): send this through an SMS gateway. Until then it is
      // logged and, outside production, exposed via devResetStore for easy
      // manual testing.
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "forget-password") return;
        const message = `Your ZUP TECH password reset code is ${otp}. It expires in 10 minutes — do not share it with anyone.`;
        console.log(`[auth] ${message} (to ${email})`);
        if (!isProduction) devResetStore.set(email, otp);
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
