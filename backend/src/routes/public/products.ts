import { Elysia } from "elysia";
import { productsQueryDto } from "../../dtos/products.dto";
import { prisma } from "../../lib/db";
import { notFound } from "../../lib/http";
import { productInclude, toPublicProduct } from "../../lib/serialize";

/** Storefront catalog — only `visible` products, public fields only. */
export const publicProducts = new Elysia({ name: "routes/public/products", detail: { tags: ["Storefront"] } })
  .get(
    "/api/products",
    async ({ query }) => {
      const products = await prisma.product.findMany({
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
