import { Elysia } from "elysia";
import { prisma } from "../../lib/db";
import { toIndustrialService, toService } from "../../lib/serialize";

/** The /solutions page's two card lists, both admin-managed. Service ids are
 *  what POST /api/leads expects as `serviceId`. */
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
  });
