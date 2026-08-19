import { Elysia } from "elysia";
import { Prisma } from "../../generated/client";
import {
  MAX_CAMPAIGN_GALLERY,
  MAX_CAMPAIGN_QC_IMAGES,
  createLandingPageDto,
  listLandingPagesQueryDto,
  updateLandingPageDto,
  uploadLandingGalleryDto,
  uploadLandingQcImageDto,
} from "../../dtos/landing-pages.dto";
import { prisma } from "../../lib/db";
import { LIST_CAP } from "../../lib/rules";
import { badRequest, conflict, notFound } from "../../lib/http";
import { assertCan } from "../../lib/rbac";
import { campaignGallery, landingPageInclude, toLandingPage } from "../../lib/serialize";
import { deleteMediaByUrl, uploadMedia } from "../../lib/storage";
import { staffGuard } from "./guard";

/**
 * Landing-page CRUD (`landingpages` module).
 *
 * Publishing has a side effect beyond visibility: an off-catalogue product
 * (`visible: false`) becomes orderable while at least one of its pages is
 * published — see orderableProductWhere() in lib/rules.ts. Unpublishing the
 * last one closes checkout for it again, which is why unpublish and delete
 * are ordinary operations here rather than anything special-cased.
 */

/**
 * The `countdownEndsAt` a write should actually store, or `{}` to leave it.
 *
 * The urgency block is optional, and "" is how the admin says "no deadline" —
 * `toLandingPage` emits exactly that for a null column, so it comes straight
 * back on the next save. Prisma refuses it: the column is `DateTime?` and an
 * empty string is not an ISO-8601 timestamp, so the write threw
 * PrismaClientValidationError and the route answered 500. It hit every
 * campaign saved without a deadline — the default for a new page, and the
 * majority of real ones.
 *
 * A malformed date gets a 400 naming the field rather than the same 500;
 * `new Date("nonsense")` is an Invalid Date, which Prisma would reject too.
 *
 * Typed against a loose record on purpose: `createLandingPageDto` builds its
 * optional half through `Object.fromEntries`, which erases those keys from the
 * static type, so the create body has no `countdownEndsAt` for TypeScript to
 * match on even though the schema validates one at runtime.
 */
function countdownData(body: Record<string, unknown>): { countdownEndsAt?: Date | null } {
  const raw = body.countdownEndsAt;
  if (raw === undefined) return {};
  if (raw === "") return { countdownEndsAt: null };
  const at = new Date(String(raw));
  if (Number.isNaN(at.getTime())) {
    throw badRequest(`countdownEndsAt is not a valid date: "${String(raw)}"`);
  }
  return { countdownEndsAt: at };
}

/** Slugs are the public URL — a collision would silently hijack a live
 *  campaign's traffic, so it 409s rather than letting the unique index 500. */
async function assertSlugFree(slug: string, exceptId?: string) {
  const clash = await prisma.landingPage.findUnique({ where: { slug } });
  if (clash && clash.id !== exceptId) {
    throw conflict(`Slug "${slug}" is already used by another landing page`);
  }
}


/**
 * Every file this campaign owns, minus anything another campaign still uses.
 *
 * `duplicate` copies media URLs rather than re-uploading them, so two rows can
 * legitimately point at one file. Deleting either used to free it for both —
 * the copy kept a URL that 404s, with nothing on the page to say why. One
 * query over a table with tens of rows buys the check.
 *
 * The two superseded columns are included on purpose: the migration blanked
 * them, but a row written by an older admin client mid-rollout can still carry
 * one, and an orphan on Cloudinary is billed forever.
 *
 * Call this BEFORE deleting the row — the query excludes `lp.id`, and after
 * the delete there is no id left to exclude.
 */
async function campaignMediaToRelease(lp: {
  id: string;
  galleryItems: unknown;
  qcImages: string[];
  qcImage: string;
  videoUrl: string;
  heroVideoUrl: string;
}): Promise<string[]> {
  const urlsOf = (row: {
    galleryItems: unknown;
    qcImages: string[];
    qcImage: string;
    videoUrl: string;
    heroVideoUrl: string;
  }) =>
    [
      ...campaignGallery(row.galleryItems).map((m) => m.url),
      ...row.qcImages,
      row.qcImage,
      row.videoUrl,
      row.heroVideoUrl,
    ].filter(Boolean);

  const mine = new Set(urlsOf(lp));
  if (mine.size === 0) return [];

  const others = await prisma.landingPage.findMany({
    where: { id: { not: lp.id } },
    select: {
      galleryItems: true,
      qcImages: true,
      qcImage: true,
      videoUrl: true,
      heroVideoUrl: true,
    },
  });
  for (const other of others) for (const url of urlsOf(other)) mine.delete(url);
  return [...mine];
}

export const adminLandingPages = new Elysia({
  name: "routes/admin/landing-pages",
  detail: { tags: ["Admin · Landing pages"] },
})
  .use(staffGuard)

  .get(
    "/admin/api/landing-pages",
    async ({ query, staffCtx }) => {
      assertCan(staffCtx, "landingpages", "view");
      const pages = await prisma.landingPage.findMany({
        take: LIST_CAP,
        where: query.published === undefined ? undefined : { published: query.published },
        orderBy: { createdAt: "desc" },
        include: landingPageInclude,
      });

      /*
       * Sales per campaign, in one aggregate for the whole list.
       *
       * This is the number the screen exists to show — what each campaign
       * actually sold — and it is counted from the orders themselves rather
       * than from a counter, so it cannot drift from them. Cancelled orders
       * are excluded: an order that was placed and then cancelled is not
       * revenue, and leaving it in would flatter every campaign that attracts
       * impulse buys.
       */
      const stats = await prisma.order.groupBy({
        by: ["landingPageId"],
        where: {
          landingPageId: { in: pages.map((p) => p.id) },
          status: { not: "Cancelled" },
        },
        _count: { _all: true },
        _sum: { total: true },
      });
      const byPage = new Map(
        stats.map((row) => [
          row.landingPageId,
          { orderCount: row._count._all, revenue: row._sum.total ?? 0 },
        ]),
      );

      return pages.map((page) =>
        toLandingPage(page, byPage.get(page.id) ?? { orderCount: 0, revenue: 0 }),
      );
    },
    { query: listLandingPagesQueryDto },
  )

  .get("/admin/api/landing-pages/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "landingpages", "view");
    const page = await prisma.landingPage.findUnique({
      where: { id: params.id },
      include: landingPageInclude,
    });
    if (!page) throw notFound("Landing page");
    return toLandingPage(page);
  })

  .post(
    "/admin/api/landing-pages",
    async ({ body, set, staffCtx }) => {
      assertCan(staffCtx, "landingpages", "manage");
      const product = await prisma.product.findUnique({ where: { id: body.productId } });
      if (!product) throw badRequest(`Unknown product: ${body.productId}`);
      await assertSlugFree(body.slug);

      const page = await prisma.landingPage.create({
        data: { ...body, ...countdownData(body) },
        include: landingPageInclude,
      });
      set.status = 201;
      return toLandingPage(page);
    },
    { body: createLandingPageDto },
  )

  .patch(
    "/admin/api/landing-pages/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "landingpages", "manage");
      const existing = await prisma.landingPage.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Landing page");

      if (body.productId) {
        const product = await prisma.product.findUnique({ where: { id: body.productId } });
        if (!product) throw badRequest(`Unknown product: ${body.productId}`);
      }
      if (body.slug) await assertSlugFree(body.slug, params.id);

      const page = await prisma.landingPage.update({
        where: { id: params.id },
        data: { ...body, ...countdownData(body) },
        include: landingPageInclude,
      });
      return toLandingPage(page);
    },
    { body: updateLandingPageDto },
  )

  /**
   * Append one slide to the "what's in the box" gallery.
   *
   * A photo or a clip — `kind` comes from `uploadMedia`, which sniffs the
   * magic bytes, so the client never gets to assert what it uploaded. Same
   * shape as the product gallery: validated, re-uploaded with our own
   * Cloudinary credentials, appended to the end.
   */
  .post(
    "/admin/api/landing-pages/:id/gallery",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "landingpages", "manage");
      const existing = await prisma.landingPage.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Landing page");

      const items = campaignGallery(existing.galleryItems);
      if (items.length >= MAX_CAMPAIGN_GALLERY) {
        throw badRequest(`A campaign gallery holds at most ${MAX_CAMPAIGN_GALLERY} items`);
      }

      const media = await uploadMedia(body.file, "landing", existing.id, items.length);
      const next = [...items, { url: media.url, kind: media.mediaType, alt: "" }];
      const page = await prisma.landingPage.update({
        where: { id: existing.id },
        data: { galleryItems: next as unknown as Prisma.InputJsonValue },
        include: landingPageInclude,
      });
      return toLandingPage(page);
    },
    { body: uploadLandingGalleryDto },
  )

  /** Remove one slide by its position — later slides shift down. */
  .delete("/admin/api/landing-pages/:id/gallery/:index", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "landingpages", "manage");
    const existing = await prisma.landingPage.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound("Landing page");

    const items = campaignGallery(existing.galleryItems);
    const index = Number(params.index);
    if (!Number.isInteger(index) || index < 0 || index >= items.length) {
      throw badRequest("No gallery item at that position");
    }

    const next = [...items];
    const [removed] = next.splice(index, 1);
    const page = await prisma.landingPage.update({
      where: { id: existing.id },
      data: { galleryItems: next as unknown as Prisma.InputJsonValue },
      include: landingPageInclude,
    });
    // The row stops pointing at the file before the file goes: a failed write
    // must never leave a campaign showing a picture that no longer exists.
    // A pasted YouTube link is passed in too — deleteMediaByUrl no-ops on
    // anything that is not one of ours.
    if (removed?.url) await deleteMediaByUrl(removed.url);
    return toLandingPage(page);
  })

  /** Append one photo to the quality block. */
  .post(
    "/admin/api/landing-pages/:id/qc-images",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "landingpages", "manage");
      const existing = await prisma.landingPage.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Landing page");

      if (existing.qcImages.length >= MAX_CAMPAIGN_QC_IMAGES) {
        throw badRequest(`The quality block holds at most ${MAX_CAMPAIGN_QC_IMAGES} photos`);
      }

      const media = await uploadMedia(body.file, "landing", existing.id, existing.qcImages.length);
      const page = await prisma.landingPage.update({
        where: { id: existing.id },
        data: { qcImages: [...existing.qcImages, media.url] },
        include: landingPageInclude,
      });
      return toLandingPage(page);
    },
    { body: uploadLandingQcImageDto },
  )

  /** Remove one quality photo by its position — later photos shift down. */
  .delete("/admin/api/landing-pages/:id/qc-images/:index", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "landingpages", "manage");
    const existing = await prisma.landingPage.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound("Landing page");

    const index = Number(params.index);
    if (!Number.isInteger(index) || index < 0 || index >= existing.qcImages.length) {
      throw badRequest("No quality photo at that position");
    }

    const qcImages = [...existing.qcImages];
    const [oldUrl] = qcImages.splice(index, 1);
    const page = await prisma.landingPage.update({
      where: { id: existing.id },
      data: { qcImages },
      include: landingPageInclude,
    });
    if (oldUrl) await deleteMediaByUrl(oldUrl);
    return toLandingPage(page);
  })

  .delete("/admin/api/landing-pages/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "landingpages", "manage");
    const existing = await prisma.landingPage.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound("Landing page");
    // Resolved before the delete, while the row is still there to exclude
    // itself from the "does anyone else use this file" query.
    const release = await campaignMediaToRelease(existing);
    await prisma.landingPage.delete({ where: { id: params.id } });
    // The row is gone, so nothing of ours can point at these files any more —
    // drop them rather than leave paid-for storage nobody can reach. Same
    // order as the uploads above: the database write first, the files second.
    await Promise.all(release.map(deleteMediaByUrl));
    return { ok: true };
  })

  /* ===== Lifecycle shortcuts =====
   *
   * Publish/unpublish are their own endpoints rather than a PATCH of
   * `published`, because they are the actions the admin list actually offers
   * and they read as an audit-friendly verb in the access log. */

  .post("/admin/api/landing-pages/:id/publish", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "landingpages", "manage");
    const existing = await prisma.landingPage.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound("Landing page");
    const page = await prisma.landingPage.update({
      where: { id: params.id },
      data: { published: true },
      include: landingPageInclude,
    });
    return toLandingPage(page);
  })

  .post("/admin/api/landing-pages/:id/unpublish", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "landingpages", "manage");
    const existing = await prisma.landingPage.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound("Landing page");
    const page = await prisma.landingPage.update({
      where: { id: params.id },
      data: { published: false },
      include: landingPageInclude,
    });
    return toLandingPage(page);
  })

  .post("/admin/api/landing-pages/:id/duplicate", async ({ params, set, staffCtx }) => {
    assertCan(staffCtx, "landingpages", "manage");
    const source = await prisma.landingPage.findUnique({ where: { id: params.id } });
    if (!source) throw notFound("Landing page");

    // Copies start unpublished with counters reset — a duplicate is a draft
    // for the next campaign, and inheriting the original's views/orders would
    // corrupt both pages' reporting.
    const base = `${source.slug}-copy`;
    let slug = base;
    for (let n = 2; await prisma.landingPage.findUnique({ where: { slug } }); n++) {
      slug = `${base}-${n}`;
    }

    /*
     * Copy everything, then override what a copy must not inherit.
     *
     * This was an explicit list of the eleven columns the model had when it
     * was written, and it was never revisited. By the time the campaign
     * template was rebuilt it dropped 52 of 70 fields: every line of campaign
     * copy, the whole palette, the product row — and `headline`, so a
     * duplicated page lost even its <h1>. Duplicating a finished Bengali
     * campaign produced a blank page with a price on it, which is the
     * opposite of the one thing the button is for.
     *
     * An allow-list fails silently and gets no louder as the model grows.
     * Listing the exclusions instead means a new column is carried by
     * default, and the worst a future omission can do is copy something it
     * should have reset — visible, and not a lost campaign.
     */
    const {
      id: _id,
      slug: _slug,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      // The view counter belongs to the page that earned it; inheriting it
      // would corrupt both pages' reporting. Orders need no exclusion — they
      // are counted from Order rows that point at the original.
      viewCount: _viewCount,
      // A copy is a draft for the next campaign, never live on creation.
      published: _published,
      title,
      /*
       * The Json columns are pulled out and put back with a cast below.
       *
       * Prisma reads them as `JsonValue`, which includes `null`, and refuses
       * that same `null` in a create input. All four are non-nullable with
       * defaults, so the null arm is unreachable — but the types cannot see
       * that. Naming them here is deliberate: a new Json column becomes a
       * compile error rather than a silent omission, which is exactly the
       * failure this rewrite exists to remove.
       */
      features,
      specs,
      testimonials,
      formLabels,
      galleryItems,
      ...copyable
    } = source;

    const page = await prisma.landingPage.create({
      data: {
        ...copyable,
        features: features as Prisma.InputJsonValue,
        specs: specs as Prisma.InputJsonValue,
        testimonials: testimonials as Prisma.InputJsonValue,
        formLabels: formLabels as Prisma.InputJsonValue,
        galleryItems: galleryItems as Prisma.InputJsonValue,
        title: `${title} (copy)`,
        slug,
        published: false,
      },
      include: landingPageInclude,
    });
    set.status = 201;
    return toLandingPage(page);
  });
