import { Elysia } from "elysia";
import {
  updateContactDto,
  updateCopyDto,
  updateIntegrationsDto,
  updateSlidesDto,
  uploadSlideImageDto,
} from "../../dtos/content.dto";
import { prisma } from "../../lib/db";
import { badRequest } from "../../lib/http";
import { assertCan } from "../../lib/rbac";
import { GTM_ID_RE } from "../../lib/rules";
import { toSlide } from "../../lib/serialize";
import { deleteMediaByUrl, uploadMedia } from "../../lib/storage";
import { staffGuard } from "./guard";

/**
 * Admin-managed site content: hero slides, copy, contact details and
 * integrations. All are whole-document PUTs — the panel edits the full set
 * and saves it back, which keeps ordering explicit.
 */
export const adminContent = new Elysia({ name: "routes/admin/content", detail: { tags: ["Admin · Content"] } })
  .use(staffGuard)

  .get("/admin/api/slides", async ({ staffCtx }) => {
    assertCan(staffCtx, "homepage", "view");
    const slides = await prisma.heroSlide.findMany({ orderBy: { sort: "asc" } });
    return slides.map(toSlide);
  })

  .put(
    "/admin/api/slides",
    async ({ body, staffCtx }) => {
      assertCan(staffCtx, "homepage", "manage");

      // Whole-set replace: any previously uploaded image not reused in the
      // new set is now unreferenced — clean it up on the storage service
      // instead of leaking it forever (same convention as products.ts).
      const before = await prisma.heroSlide.findMany({ select: { image: true } });
      const kept = new Set(body.slides.map((s) => s.image).filter((url): url is string => !!url));
      const orphaned = before
        .map((s) => s.image)
        .filter((url): url is string => !!url && !kept.has(url));

      const slides = await prisma.$transaction(async (tx) => {
        await tx.heroSlide.deleteMany();
        return Promise.all(
          body.slides.map((slide, index) =>
            tx.heroSlide.create({
              data: {
                ...slide,
                image: slide.image ?? null,
                // Omitted by any client that predates video slides, and those
                // were all stills.
                mediaType: slide.mediaType ?? "image",
                // Same reasoning for pages: a client that predates per-page
                // heroes sends none, and every slide it knows about belonged
                // to the home carousel.
                pages: slide.pages ?? ["home"],
                sort: index,
              },
            }),
          ),
        );
      });
      await Promise.all(orphaned.map(deleteMediaByUrl));
      return slides.map(toSlide);
    },
    { body: updateSlidesDto },
  )

  /**
   * Upload a banner image and get back its URL — slide rows have no stable
   * id across saves (the PUT above deletes and recreates the whole set), so
   * this is a standalone step: upload, then put the returned url in a
   * slide's `image` field before PUTting the set.
   */
  .post(
    "/admin/api/slides/image",
    async ({ body, staffCtx }) => {
      assertCan(staffCtx, "homepage", "manage");
      const media = await uploadMedia(body.file, "heroslide", crypto.randomUUID(), 0);
      // The kind comes back with the URL so the admin can store it on the
      // slide without re-deriving it from the file or the URL shape.
      return { url: media.url, mediaType: media.mediaType };
    },
    { body: uploadSlideImageDto },
  )

  .put(
    "/admin/api/copy",
    async ({ body, staffCtx }) => {
      assertCan(staffCtx, "sitecontent", "manage");
      await prisma.siteConfig.update({ where: { id: 1 }, data: body });
      return { ok: true };
    },
    { body: updateCopyDto },
  )

  .put(
    "/admin/api/contact",
    async ({ body, staffCtx }) => {
      assertCan(staffCtx, "sitecontent", "manage");
      await prisma.siteConfig.update({ where: { id: 1 }, data: body });
      return { ok: true };
    },
    { body: updateContactDto },
  )

  .put(
    "/admin/api/integrations",
    async ({ body, staffCtx }) => {
      assertCan(staffCtx, "sitecontent", "manage");

      // An enabled GTM with a malformed id would silently never load (§4.10)
      // — reject it here so the mistake is visible to the person saving.
      if (body.gtmEnabled && !GTM_ID_RE.test(body.gtmId)) {
        throw badRequest("GTM id must match GTM-XXXXXXX before enabling");
      }

      await prisma.siteConfig.update({ where: { id: 1 }, data: body });
      return { ok: true };
    },
    { body: updateIntegrationsDto },
  );
