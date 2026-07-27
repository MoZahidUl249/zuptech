import { t } from "elysia";

/** Staff panel sign-in (Better Auth username plugin). */
export const staffLoginDto = t.Object({
  username: t.String({ minLength: 1, maxLength: 50 }),
  password: t.String({ minLength: 1, maxLength: 200 }),
});

/** Customer phone + password auth. */
export const registerCustomerDto = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  phone: t.String(),
  password: t.String({ minLength: 6, maxLength: 200 }),
});

export const loginCustomerDto = t.Object({
  phone: t.String(),
  password: t.String({ minLength: 1, maxLength: 200 }),
});

export const forgotPasswordDto = t.Object({ phone: t.String() });

/** OTP is always exactly 6 digits — see generateOtp() in routes/public/auth.ts. */
export const resetPasswordDto = t.Object({
  phone: t.String(),
  otp: t.String({ minLength: 6, maxLength: 6, pattern: "^[0-9]{6}$" }),
  password: t.String({ minLength: 6, maxLength: 200 }),
});

export type StaffLoginDto = typeof staffLoginDto.static;
export type RegisterCustomerDto = typeof registerCustomerDto.static;
export type LoginCustomerDto = typeof loginCustomerDto.static;
export type ForgotPasswordDto = typeof forgotPasswordDto.static;
export type ResetPasswordDto = typeof resetPasswordDto.static;
