import { Elysia } from "elysia";
import {
  createTeamMemberDto,
  updateTeamMemberDto,
  uploadTeamPhotoDto,
} from "../../dtos/team.dto";
import { prisma } from "../../lib/db";
import { notFound } from "../../lib/http";
import { assertCan } from "../../lib/rbac";
import { toTeamMember } from "../../lib/serialize";
import { deleteMediaByUrl, uploadMedia } from "../../lib/storage";
import { staffGuard } from "./guard";

/**
 * The contact page's people (`sitecontent` module).
 *
 * Per-item CRUD rather than a whole-document PUT, for the same reason the card
 * catalogues are: the photo is uploaded against a stable row id, so a member
 * has to exist before their picture can be attached.
 */
export const adminTeam = new Elysia({
  name: "routes/admin/team",
  detail: { tags: ["Admin · Team"] },
})
  .use(staffGuard)

  .get("/admin/api/team", async ({ staffCtx }) => {
    assertCan(staffCtx, "sitecontent", "view");
    const members = await prisma.teamMember.findMany({ orderBy: { sort: "asc" } });
    return members.map(toTeamMember);
  })

  .post(
    "/admin/api/team",
    async ({ body, staffCtx, set }) => {
      assertCan(staffCtx, "sitecontent", "manage");
      const member = await prisma.teamMember.create({ data: body });
      set.status = 201;
      return toTeamMember(member);
    },
    { body: createTeamMemberDto },
  )

  .patch(
    "/admin/api/team/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "sitecontent", "manage");
      const existing = await prisma.teamMember.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Team member");

      const member = await prisma.teamMember.update({ where: { id: params.id }, data: body });
      return toTeamMember(member);
    },
    { body: updateTeamMemberDto },
  )

  .delete("/admin/api/team/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "sitecontent", "manage");
    const existing = await prisma.teamMember.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound("Team member");

    await prisma.teamMember.delete({ where: { id: params.id } });
    if (existing.photo) await deleteMediaByUrl(existing.photo);
    return { ok: true };
  })

  .post(
    "/admin/api/team/:id/photo",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "sitecontent", "manage");
      const existing = await prisma.teamMember.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Team member");

      const media = await uploadMedia(body.file, "team", existing.id, 0);

      const member = await prisma.teamMember.update({
        where: { id: existing.id },
        data: { photo: media.url },
      });
      if (existing.photo) await deleteMediaByUrl(existing.photo); // release the replaced asset
      return toTeamMember(member);
    },
    { body: uploadTeamPhotoDto },
  );
