import { Elysia } from "elysia";
import { productsQueryDto } from "../../dtos/products.dto";
import { prisma } from "../../lib/db";
import { DEFAULT_PAGE_SIZE, LIST_CAP } from "../../lib/rules";
import { notFound } from "../../lib/http";
import { productInclude, toPublicProduct } from "../../lib/serialize";

/** Storefront catalog — only `visible` products, public fields only. */
export const publicProducts = new Elysia({ name: "routes/public/products", detail: { tags: ["Storefront"] } })
  .get(
    "/api/products",
    async ({ query, set }) => {
      const q = query.q?.trim();
      // Empty segments dropped so a trailing comma doesn't become an id that
      // matches nothing and silently shrinks the result.
      const ids = query.ids?.split(",").map((id) => id.trim()).filter(Boolean);
      const where = {
        visible: true,
        ...(ids?.length ? { id: { in: ids } } : {}),
        ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
        ...(query.category || query.section
          ? {
              category: {
                ...(query.category ? { name: query.category } : {}),
                ...(query.section ? { section: { name: query.section } } : {}),
              },
            }
          : {}),
      };

      /*
       * Newest first, and paged.
       *
       * This used to sort `createdAt: "asc"` under a flat 500-row cap, which is
       * the worst possible pairing: the cap dropped whatever sorted last, and
       * that was the newest stock. A shop with 4,499 visible products served
       * the oldest 500 and made the other 3,999 unreachable — they answered on
       * a direct URL but appeared in no listing and no search. Sorting
       * newest-first means the page the customer lands on is the stock we most
       * want to sell, and `offset` reaches the rest.
       */
      /*
       * An explicit id list sizes its own page. The caller named the rows it
       * wants, so defaulting to a screenful would answer a 60-id request with
       * 48 rows and no indication that the rest were dropped — the same silent
       * truncation the page default was introduced to fix at the other end.
       * LIST_CAP still bounds it.
       */
      const take = Math.min(query.limit ?? (ids?.length || DEFAULT_PAGE_SIZE), LIST_CAP);

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          take,
          skip: query.offset ?? 0,
          orderBy: { createdAt: "desc" },
          include: productInclude,
        }),
        prisma.product.count({ where }),
      ]);

      /*
       * The total rides in a header rather than wrapping the body in
       * `{items,total}`: the response stays a plain array, so every existing
       * caller (cart, account, sitemap, the admin bridge) keeps working
       * unchanged and only the shop has to learn about paging.
       */
      set.headers["x-total-count"] = String(total);
      return products.map(toPublicProduct);
    },
    { query: productsQueryDto },
  )

  .get("/api/products/:slug", async ({ params }) => {
    const product = await prisma.product.findUnique({
      where: { slug: params.slug },
      include: productInclude,
    });
    if (!product || !product.visible) throw notFound("Product");
    return toPublicProduct(product);
  });
