import { Elysia } from "elysia";
import { productsQueryDto } from "../../dtos/products.dto";
import { prisma } from "../../lib/db";
import { LIST_CAP } from "../../lib/rules";
import { notFound } from "../../lib/http";
import { productInclude, toPublicProduct } from "../../lib/serialize";

/** Storefront catalog — only `visible` products, public fields only. */
export const publicProducts = new Elysia({ name: "routes/public/products", detail: { tags: ["Storefront"] } })
  .get(
    "/api/products",
    async ({ query }) => {
      const products = await prisma.product.findMany({
        // Note the direction: this list sorts oldest-first because that is the
        // catalogue's display order, so the cap drops the NEWEST products, not
        // the stalest. That is the wrong end to lose — it is a backstop against
        // a runaway import, not a paging strategy. A shop approaching 500 live
        // products needs real pagination here before it gets there.
        take: LIST_CAP,
        where: {
          visible: true,
          ...(query.category || query.section
            ? {
                category: {
                  ...(query.category ? { name: query.category } : {}),
                  ...(query.section ? { section: { name: query.section } } : {}),
                },
              }
            : {}),
        },
        orderBy: { createdAt: "asc" },
        include: productInclude,
      });
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
