import { Elysia } from "elysia";
import { Prisma } from "../../generated/client";
import {
  createLandingPageDto,
  listLandingPagesQueryDto,
  updateLandingPageDto,
} from "../../dtos/landing-pages.dto";
import { prisma } from "../../lib/db";
import { LIST_CAP } from "../../lib/rules";
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
      // Counters belong to the page that earned them; inheriting them would
      // corrupt both pages' reporting.
      viewCount: _viewCount,
      orderCount: _orderCount,
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
      ...copyable
    } = source;

    const page = await prisma.landingPage.create({
      data: {
        ...copyable,
        features: features as Prisma.InputJsonValue,
        specs: specs as Prisma.InputJsonValue,
        testimonials: testimonials as Prisma.InputJsonValue,
        formLabels: formLabels as Prisma.InputJsonValue,
        title: `${title} (copy)`,
        slug,
        published: false,
      },
      include: landingPageInclude,
    });
    set.status = 201;
    return toLandingPage(page);
  });
