import { t } from "elysia";

/**
 * The people shown on the contact page. Not a card catalogue like
 * Service/ShowcaseCard — different fields, no slug, no layout knobs — so this
 * gets its own DTO rather than bending services.dto.ts around it.
 */

const teamFields = {
  name: t.String({ minLength: 1, maxLength: 120 }),
  role: t.String({ minLength: 1, maxLength: 120 }),
  bio: t.String({ maxLength: 600 }),
  sort: t.Integer({ minimum: 0, maximum: 999 }),
};

export const createTeamMemberDto = t.Object(teamFields);
export const updateTeamMemberDto = t.Partial(t.Object(teamFields));

export const uploadTeamPhotoDto = t.Object({
  file: t.File({ type: "image", maxSize: "8m" }),
});

export type CreateTeamMemberDto = typeof createTeamMemberDto.static;
export type UpdateTeamMemberDto = typeof updateTeamMemberDto.static;
export type UploadTeamPhotoDto = typeof uploadTeamPhotoDto.static;
