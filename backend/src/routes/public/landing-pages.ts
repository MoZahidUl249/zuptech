import { Elysia } from "elysia";
import { prisma } from "../../lib/db";
import { notFound } from "../../lib/http";
import { landingPageInclude, toPublicLandingPage } from "../../lib/serialize";

/**
 * Public campaign pages (`/lp/:slug` on the storefront).
 *
 * Unlisted by design: there is no list endpoint, only lookup by slug, and an
 * unpublished page is indistinguishable from a missing one. The response
 * embeds the full product so the page renders from a single call — which is
 * also what lets a campaign sell a product that is off the storefront, since
 * GET /api/products/:slug would 404 on it.
 */
export const publicLandingPages = new Elysia({
  name: "routes/public/landing-pages",
  detail: { tags: ["Landing pages"] },
}).get("/api/landing-pages/:slug", async ({ params }) => {
  const page = await prisma.landingPage.findUnique({
    where: { slug: params.slug },
    include: landingPageInclude,
  });
  if (!page || !page.published) throw notFound("Landing page");

  // Fire-and-forget: a failed counter must never cost us the page render, and
  // ad traffic arrives in bursts where an atomic increment is the cheap path.
  void prisma.landingPage
    .update({ where: { id: page.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  return toPublicLandingPage(page);
});
