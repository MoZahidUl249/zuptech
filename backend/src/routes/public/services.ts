import { Elysia } from "elysia";
import { prisma } from "../../lib/db";
import {
  toIndustrialService,
  toService,
  toShowcaseCard,
  toTeamMember,
} from "../../lib/serialize";

/** The three admin-managed card lists plus the contact page's people. `Service`
 *  ids are what POST /api/leads expects as `serviceId`; the rest are
 *  display-only. */
export const publicServices = new Elysia({
  name: "routes/public/services",
  detail: { tags: ["Storefront"] },
})
  .get("/api/services", async () => {
    const services = await prisma.service.findMany({ orderBy: { sort: "asc" } });
    return services.map(toService);
  })

  .get("/api/industrial-services", async () => {
    const services = await prisma.industrialService.findMany({ orderBy: { sort: "asc" } });
    return services.map(toIndustrialService);
  })

  /** The home page's own cards. Deliberately not the bookable catalogue: the
   *  front page is a shop window, and nothing here has a lead behind it. */
  .get("/api/showcase-cards", async () => {
    const cards = await prisma.showcaseCard.findMany({ orderBy: { sort: "asc" } });
    return cards.map(toShowcaseCard);
  })

  /** The people on the contact page. Empty until the client adds real ones. */
  .get("/api/team", async () => {
    const members = await prisma.teamMember.findMany({ orderBy: { sort: "asc" } });
    return members.map(toTeamMember);
  });
