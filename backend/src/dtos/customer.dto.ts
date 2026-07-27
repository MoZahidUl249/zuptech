import { t } from "elysia";

/** Signed-in customer editing their own saved profile — every field
 *  optional so the client can send just what changed. */
export const updateProfileDto = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
  address: t.Optional(t.String({ maxLength: 500 })),
  insideDhaka: t.Optional(t.Boolean()),
});

export type UpdateProfileDto = typeof updateProfileDto.static;
