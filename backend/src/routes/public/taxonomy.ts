import { Elysia } from "elysia";
import { prisma } from "../../lib/db";
import { toCategory, toSection } from "../../lib/serialize";

/**
 * The catalog taxonomy the shop's filters are built from. Sections come with
 * their categories nested so the storefront can render the whole filter tree
 * (and each category's logo) from one request, instead of deriving it by
 * scanning every product payload.
 */
export const publicTaxonomy = new Elysia({
  name: "routes/public/taxonomy",
  detail: { tags: ["Storefront"] },
})
  .get("/api/sections", async () => {
    const sections = await prisma.section.findMany({
      orderBy: { sort: "asc" },
      include: { categories: { orderBy: { sort: "asc" } } },
    });
    return sections.map(toSection);
  })

  .get("/api/categories", async () => {
    const categories = await prisma.category.findMany({
      orderBy: { sort: "asc" },
      include: { section: true },
    });
    return categories.map(toCategory);
  });
