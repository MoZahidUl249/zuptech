import { Elysia } from "elysia";
import {
  createLandingPageDto,
  listLandingPagesQueryDto,
  updateLandingPageDto,
} from "../../dtos/landing-pages.dto";
import { prisma } from "../../lib/db";
import { badRequest, conflict, notFound } from "../../lib/http";
import { assertCan } from "../../lib/rbac";
import { landingPageInclude, toLandingPage } from "../../lib/serialize";
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

/** Slugs are the public URL — a collision would silently hijack a live
 *  campaign's traffic, so it 409s rather than letting the unique index 500. */
async function assertSlugFree(slug: string, exceptId?: string) {
  const clash = await prisma.landingPage.findUnique({ where: { slug } });
  if (clash && clash.id !== exceptId) {
    throw conflict(`Slug "${slug}" is already used by another landing page`);
  }
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
        where: query.published === undefined ? undefined : { published: query.published },
        orderBy: { createdAt: "desc" },
        include: landingPageInclude,
      });
      return pages.map(toLandingPage);
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
        data: body,
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
        data: body,
        include: landingPageInclude,
      });
      return toLandingPage(page);
    },
    { body: updateLandingPageDto },
  )

  .delete("/admin/api/landing-pages/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "landingpages", "manage");
    const existing = await prisma.landingPage.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound("Landing page");
    await prisma.landingPage.delete({ where: { id: params.id } });
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

    const page = await prisma.landingPage.create({
      data: {
        title: `${source.title} (copy)`,
        slug,
        productId: source.productId,
        offerPrice: source.offerPrice,
        compareAtPrice: source.compareAtPrice,
        ribbonText: source.ribbonText,
        buttonLabel: source.buttonLabel,
        footerNote: source.footerNote,
        benefitBullets: source.benefitBullets,
        imageHint: source.imageHint,
        gtmId: source.gtmId,
        published: false,
      },
      include: landingPageInclude,
    });
    set.status = 201;
    return toLandingPage(page);
  });
