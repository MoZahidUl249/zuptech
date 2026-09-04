import { t } from "elysia";

export const permissionValueDto = t.Union([
  t.Literal("none"),
  t.Literal("view"),
  t.Literal("manage"),
]);

/** Keys are validated against ADMIN_MODULES in the route (unknown ⇒ 400). */
export const permissionsDto = t.Record(t.String(), permissionValueDto);

/** Real address for password-reset codes — not a sign-in identity (staff sign
 *  in with a username). Optional: a staff member without one simply can't
 *  self-recover, an admin still resets their password for them. "" clears it. */
const staffEmailField = t.String({ maxLength: 200, pattern: "^$|^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" });

export const createStaffDto = t.Object({
  name: t.String({ minLength: 2, maxLength: 120 }),
  phone: t.Optional(t.String({ maxLength: 20 })),
  email: t.Optional(staffEmailField),
  username: t.String({ minLength: 3, maxLength: 50, pattern: "^[a-zA-Z0-9_.-]+$" }),
  password: t.String({ minLength: 6, maxLength: 200 }),
  roleId: t.String(),
});

export const updateStaffDto = t.Partial(
  t.Object({
    name: t.String({ minLength: 2, maxLength: 120 }),
    phone: t.String({ maxLength: 20 }),
    email: staffEmailField,
    roleId: t.String(),
    password: t.String({ minLength: 6, maxLength: 200 }),
  }),
);

export const createRoleDto = t.Object({
  name: t.String({ minLength: 2, maxLength: 80 }),
  permissions: permissionsDto,
});

export const updateRoleDto = t.Partial(
  t.Object({
    name: t.String({ minLength: 2, maxLength: 80 }),
    permissions: permissionsDto,
  }),
);

/**
 * A manager setting someone else's password.
 *
 * Same minimum as staff creation — a password set under time pressure at a
 * desk is exactly the one that ends up being "zup1234", and there is no reason
 * for this path to be weaker than the one that created the account.
 */
export const setStaffPasswordDto = t.Object({
  password: t.String({ minLength: 6, maxLength: 200 }),
});

export type PermissionsDto = typeof permissionsDto.static;
export type CreateStaffDto = typeof createStaffDto.static;
export type UpdateStaffDto = typeof updateStaffDto.static;
export type CreateRoleDto = typeof createRoleDto.static;
export type UpdateRoleDto = typeof updateRoleDto.static;

export type SetStaffPasswordDto = typeof setStaffPasswordDto.static;
