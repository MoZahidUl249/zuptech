import { t } from "elysia";

/** Staff panel sign-in (Better Auth username plugin). */
export const staffLoginDto = t.Object({
  username: t.String({ minLength: 1, maxLength: 50 }),
  password: t.String({ minLength: 1, maxLength: 200 }),
});

/** Customer phone + password auth. The email is not a sign-in identity —
 *  it's the address a password-reset code is delivered to, so it's collected
 *  up front and must be unique across customers. */
export const registerCustomerDto = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  phone: t.String(),
  email: t.String({ format: "email", maxLength: 200 }),
  password: t.String({ minLength: 6, maxLength: 200 }),
});

export const loginCustomerDto = t.Object({
  phone: t.String(),
  password: t.String({ minLength: 1, maxLength: 200 }),
});

/**
 * "Set a password on the number I just ordered with." Guest checkout creates a
 * Customer row but no sign-in account, so this turns one into the other
 * without asking for the name and phone the customer typed a moment ago.
 * Email is optional here (unlike register) because it only unlocks
 * password reset later — refusing the order-to-account upgrade over a missing
 * address the customer may not want to give would defeat the point.
 */
export const claimAccountDto = t.Object({
  phone: t.String(),
  password: t.String({ minLength: 6, maxLength: 200 }),
  email: t.Optional(t.String({ format: "email", maxLength: 200 })),
});

/**
 * Customer reset is keyed on the PHONE, because that is the identifier a
 * customer signs in with and the one every account is guaranteed to have.
 *
 * It was keyed on `Customer.email`, which is nullable and empty for every
 * guest checkout — so the customers who most needed a reset could not even ask
 * for one. The code now goes to the phone by SMS (lib/sms), falling back to
 * email for the accounts that have one.
 */
export const forgotPasswordPhoneDto = t.Object({
  phone: t.String({ minLength: 6, maxLength: 20 }),
});

export const resetPasswordPhoneDto = t.Object({
  phone: t.String({ minLength: 6, maxLength: 20 }),
  otp: t.String({ minLength: 6, maxLength: 6, pattern: "^[0-9]{6}$" }),
  password: t.String({ minLength: 6, maxLength: 200 }),
});

/** Staff reset stays keyed on the real email address — see routes/admin/auth.ts. */
export const forgotPasswordDto = t.Object({
  email: t.String({ format: "email", maxLength: 200 }),
});

/** OTP is always exactly 6 digits — see the emailOTP plugin config in lib/auth.ts. */
export const resetPasswordDto = t.Object({
  email: t.String({ format: "email", maxLength: 200 }),
  otp: t.String({ minLength: 6, maxLength: 6, pattern: "^[0-9]{6}$" }),
  password: t.String({ minLength: 6, maxLength: 200 }),
});

export type StaffLoginDto = typeof staffLoginDto.static;
export type RegisterCustomerDto = typeof registerCustomerDto.static;
export type LoginCustomerDto = typeof loginCustomerDto.static;
export type ClaimAccountDto = typeof claimAccountDto.static;
export type ForgotPasswordDto = typeof forgotPasswordDto.static;
export type ForgotPasswordPhoneDto = typeof forgotPasswordPhoneDto.static;
export type ResetPasswordPhoneDto = typeof resetPasswordPhoneDto.static;
export type ResetPasswordDto = typeof resetPasswordDto.static;
