import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP, username } from "better-auth/plugins";
import { prisma } from "./db";
import { otpEmail, sendMail } from "./mail";
import { parseInternalEmail } from "./rules";

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
 * Password reset uses the official `emailOTP` plugin (6-digit code, 10-minute
 * TTL, 5 attempts, single-use — atomic verify/consume handled by Better Auth
 * itself) rather than a hand-rolled OTP table. The route layer only calls
 * `requestPasswordResetEmailOTP` / `resetPasswordEmailOTP`.
 */

/**
 * Where a reset code for this account should actually be delivered, or null
 * when it can't be. The `email` Better Auth hands us is the *synthetic*
 * sign-in identifier, so it is translated back to the account and its real
 * address on `Customer.email` / `Staff.email`.
 */
async function deliverableAddress(syntheticEmail: string): Promise<string | null> {
  const parsed = parseInternalEmail(syntheticEmail);
  if (!parsed) return null;

  if (parsed.audience === "customer") {
    const customer = await prisma.customer.findUnique({
      where: { phone: parsed.key },
      select: { email: true },
    });
    return customer?.email ?? null;
  }

  const staff = await prisma.staff.findUnique({
    where: { username: parsed.key },
    select: { email: true },
  });
  return staff?.email ?? null;
}

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

      // Only the password-reset flow is wired up (routes/{public,admin}/auth.ts)
      // — sign-in/email-verification/change-email OTPs are never requested.
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "forget-password") return;

        // An account with no address on file (legacy signup, guest checkout,
        // staff created before the email field) simply gets nothing. Silence
        // here is deliberate: the caller already returned {ok:true}, so a
        // missing address must not become an observable difference.
        const to = await deliverableAddress(email);
        if (!to) return;

        await sendMail({ to, ...otpEmail(otp) });
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
