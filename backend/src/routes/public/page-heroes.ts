import { Elysia } from "elysia";
import { prisma } from "../../lib/db";
import { PAGE_HERO_KEYS } from "../../lib/rules";
import { toPageHero } from "../../lib/serialize";

/**
 * Hero art for the storefront. One call returns every page's hero so the
 * layout can be rendered without a per-page round trip, and a page that has
 * never been edited comes back as `mode: "plain"` — its built-in design.
 */
export const publicPageHeroes = new Elysia({
  name: "routes/public/page-heroes",
  detail: { tags: ["Site"] },
}).get("/api/page-heroes", async () => {
  const heroes = await prisma.pageHero.findMany({
    include: { posters: { orderBy: { sort: "asc" } } },
  });
  const byKey = new Map(heroes.map((h) => [h.pageKey, h]));
  return PAGE_HERO_KEYS.map((pageKey) => {
    const row = byKey.get(pageKey);
    return row
      ? toPageHero(row)
      : { pageKey, mode: "plain", background: "", overlay: 55, posters: [] };
  });
});
