import { t } from "elysia";

export const permissionValueDto = t.Union([
  t.Literal("none"),
  t.Literal("view"),
  t.Literal("manage"),
]);

/** Keys are validated against ADMIN_MODULES in the route (unknown ⇒ 400). */
export const permissionsDto = t.Record(t.String(), permissionValueDto);

export const createStaffDto = t.Object({
  name: t.String({ minLength: 2, maxLength: 120 }),
  phone: t.Optional(t.String({ maxLength: 20 })),
  username: t.String({ minLength: 3, maxLength: 50, pattern: "^[a-zA-Z0-9_.-]+$" }),
  password: t.String({ minLength: 6, maxLength: 200 }),
  roleId: t.String(),
});

export const updateStaffDto = t.Partial(
  t.Object({
    name: t.String({ minLength: 2, maxLength: 120 }),
    phone: t.String({ maxLength: 20 }),
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

export type PermissionsDto = typeof permissionsDto.static;
export type CreateStaffDto = typeof createStaffDto.static;
export type UpdateStaffDto = typeof updateStaffDto.static;
export type CreateRoleDto = typeof createRoleDto.static;
export type UpdateRoleDto = typeof updateRoleDto.static;
