import { Elysia } from "elysia";
import { prisma } from "../../lib/db";
import { notFound } from "../../lib/http";
import { allowHit, clientIp } from "../../lib/rate-limit";
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
}).get("/api/landing-pages/:slug", async ({ params, request, server }) => {
  const page = await prisma.landingPage.findUnique({
    where: { slug: params.slug },
    include: landingPageInclude,
  });
  if (!page || !page.published) throw notFound("Landing page");

  /*
   * Count the view at most a few times per visitor per page.
   *
   * This was the one public write with no guard on it, which made `viewCount`
   * trivially inflatable by anyone with a loop — and it is the number someone
   * judges ad spend by. The window is deliberately generous: a real visitor
   * reloading or coming back within the hour is not interesting, and the point
   * is to blunt automation, not to be an exact analytics counter.
   *
   * Never blocks the response: exceeding the limit skips the increment and
   * still serves the page, because a rate limit on a counter must not become
   * a rate limit on the campaign itself.
   */
  const ip = clientIp(request, server);
  if (allowHit(`lp-view:${ip}:${page.slug}`, 5, 60 * 60_000)) {
    // Fire-and-forget: a failed counter must never cost us the page render, and
    // ad traffic arrives in bursts where an atomic increment is the cheap path.
    void prisma.landingPage
      .update({ where: { id: page.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});
  }

  return toPublicLandingPage(page);
});
