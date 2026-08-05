import { Elysia } from "elysia";
import {
  createProductDto,
  updateFeaturedDto,
  updateProductDto,
  uploadProductPhotoDto,
  uploadProductVideoDto,
} from "../../dtos/products.dto";
import { prisma } from "../../lib/db";
import { badRequest, conflict, notFound } from "../../lib/http";
import { assertCan } from "../../lib/rbac";
import { productInclude, toAdminProduct } from "../../lib/serialize";
import { deleteMediaByUrl, uploadMedia } from "../../lib/storage";
import { staffGuard } from "./guard";

/** Gallery cap — first photo is the cover; matches products.dto.ts's maxItems. */
const MAX_PRODUCT_PHOTOS = 12;

async function featuredIds(): Promise<string[]> {
  const config = await prisma.siteConfig.findUniqueOrThrow({ where: { id: 1 } });
  return config.featuredIds;
}

/**
 * Next free sequential SKU (ZT-P0011, ZT-P0012, …). Generated once at create
 * time and stable afterwards — stock movements denormalize the SKU.
 */
async function nextSku(): Promise<string> {
  let n = (await prisma.product.count()) + 1;
  for (;;) {
    const sku = `ZT-P${String(n).padStart(4, "0")}`;
    if (!(await prisma.product.findUnique({ where: { sku } }))) return sku;
    n++;
  }
}

/** Both tier ladders are keyed @@unique([productId, minQty]), so a repeated
 *  threshold is a 400 rather than a Prisma constraint error. */
function assertNoDuplicateMinQty(field: string, offers: { minQty: number }[] | undefined) {
  if (!offers) return;
  const seen = new Set<number>();
  for (const { minQty } of offers) {
    if (seen.has(minQty)) throw badRequest(`Duplicate ${field} tier for minQty ${minQty}`);
    seen.add(minQty);
  }
}

export const adminProducts = new Elysia({ name: "routes/admin/products", detail: { tags: ["Admin · Products"] } })
  .use(staffGuard)

  /** Full catalog, admin shape (cost, stock, featured flag…). */
  .get("/admin/api/products", async ({ staffCtx }) => {
    assertCan(staffCtx, "products", "view");
    const [products, featured] = await Promise.all([
      prisma.product.findMany({ orderBy: { createdAt: "asc" }, include: productInclude }),
      featuredIds(),
    ]);
    return products.map((p) => toAdminProduct(p, featured));
  })

  .post(
    "/admin/api/products",
    async ({ body, staffCtx, set }) => {
      assertCan(staffCtx, "products", "manage");

      const { quantityOffers, freeDeliveryOffers, ...fields } = body;
      assertNoDuplicateMinQty("quantityOffers", quantityOffers);
      assertNoDuplicateMinQty("freeDeliveryOffers", freeDeliveryOffers);

      const id = fields.id ?? fields.slug.replace(/-/g, "").slice(0, 20);
      const clash = await prisma.product.findFirst({
        // {sku: undefined} would match every row — only include it when given.
        where: { OR: [{ id }, { slug: fields.slug }, ...(fields.sku ? [{ sku: fields.sku }] : [])] },
      });
      if (clash) throw conflict("A product with the same id, slug or SKU already exists");

      const sku = fields.sku ?? (await nextSku());
      const product = await prisma.product.create({
        data: {
          ...fields,
          id,
          sku,
          ...(quantityOffers ? { quantityOffers: { create: quantityOffers } } : {}),
          ...(freeDeliveryOffers ? { freeDeliveryOffers: { create: freeDeliveryOffers } } : {}),
        },
        include: productInclude,
      });
      set.status = 201;
      return toAdminProduct(product, await featuredIds());
    },
    { body: createProductDto },
  )

  .patch(
    "/admin/api/products/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "products", "manage");

      const { quantityOffers, freeDeliveryOffers, ...fields } = body;
      assertNoDuplicateMinQty("quantityOffers", quantityOffers);
      assertNoDuplicateMinQty("freeDeliveryOffers", freeDeliveryOffers);

      const existing = await prisma.product.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Product");

      if (fields.slug && fields.slug !== existing.slug) {
        // Slugs feed URLs and SEO — changing one is allowed but must not collide.
        const clash = await prisma.product.findUnique({ where: { slug: fields.slug } });
        if (clash) throw conflict(`Slug "${fields.slug}" is already in use`);
      }

      const product = await prisma.$transaction(async (tx) => {
        // Replace-all semantics for tiers, same as the featured list: sending
        // a ladder swaps the whole thing, omitting it leaves the ladder alone.
        if (quantityOffers) await tx.quantityOffer.deleteMany({ where: { productId: params.id } });
        if (freeDeliveryOffers) {
          await tx.freeDeliveryOffer.deleteMany({ where: { productId: params.id } });
        }
        return tx.product.update({
          where: { id: params.id },
          data: {
            ...fields,
            ...(quantityOffers ? { quantityOffers: { create: quantityOffers } } : {}),
            ...(freeDeliveryOffers ? { freeDeliveryOffers: { create: freeDeliveryOffers } } : {}),
          },
          include: productInclude,
        });
      });
      return toAdminProduct(product, await featuredIds());
    },
    { body: updateProductDto },
  )

  /**
   * Deleting is only possible for products with no history (orders, POs,
   * movements reference them). Anything with history should be hidden instead.
   */
  .delete("/admin/api/products/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "products", "manage");

    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: { _count: { select: { orderItems: true, purchaseOrders: true, movements: true } } },
    });
    if (!product) throw notFound("Product");

    const { orderItems, purchaseOrders, movements } = product._count;
    if (orderItems + purchaseOrders + movements > 0) {
      throw conflict(
        "This product has order/inventory history — set it to Hidden instead of deleting",
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.delete({ where: { id: params.id } });
      // Deleted products leave the featured row automatically (§4.7).
      const config = await tx.siteConfig.findUniqueOrThrow({ where: { id: 1 } });
      await tx.siteConfig.update({
        where: { id: 1 },
        data: { featuredIds: config.featuredIds.filter((fid) => fid !== params.id) },
      });
    });

    // Release the gallery and promo video, same as the per-photo/video deletes
    // and the service routes already do. Without this the row goes but the
    // assets stay on Cloudinary forever, billed and unreferenced — nothing
    // else knows their URLs once the row is gone.
    await Promise.all([...product.photos, product.video].map(deleteMediaByUrl));

    return { ok: true };
  })

  /* ===== Photos & video (media-storage service) ===== */

  /** Append one photo to the gallery (first photo is the cover). */
  .post(
    "/admin/api/products/:id/photos",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "products", "manage");

      const existing = await prisma.product.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Product");
      if (existing.photos.length >= MAX_PRODUCT_PHOTOS) {
        throw badRequest(`A product can have at most ${MAX_PRODUCT_PHOTOS} photos`);
      }

      const media = await uploadMedia(body.file, "product", existing.id, existing.photos.length);
      const photos = [...existing.photos, media.url];
      const product = await prisma.product.update({
        where: { id: existing.id },
        data: { photos },
        include: productInclude,
      });

      return toAdminProduct(product, await featuredIds());
    },
    { body: uploadProductPhotoDto },
  )

  /** Remove one gallery photo by its position — later photos shift down. */
  .delete("/admin/api/products/:id/photos/:index", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "products", "manage");

    const existing = await prisma.product.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound("Product");

    const index = Number(params.index);
    if (!Number.isInteger(index) || index < 0 || index >= existing.photos.length) {
      throw badRequest("Invalid photo index");
    }

    const photos = [...existing.photos];
    const [oldUrl] = photos.splice(index, 1);

    const product = await prisma.product.update({
      where: { id: existing.id },
      data: { photos },
      include: productInclude,
    });
    if (oldUrl) await deleteMediaByUrl(oldUrl);

    return toAdminProduct(product, await featuredIds());
  })

  /** Upload/replace the promo video (an uploaded file, not a YouTube link). */
  .post(
    "/admin/api/products/:id/video",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "products", "manage");

      const existing = await prisma.product.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Product");

      const media = await uploadMedia(body.file, "product", existing.id, 0);

      const product = await prisma.product.update({
        where: { id: existing.id },
        data: { video: media.url },
        include: productInclude,
      });
      if (existing.video) await deleteMediaByUrl(existing.video);

      return toAdminProduct(product, await featuredIds());
    },
    { body: uploadProductVideoDto },
  )

  .delete("/admin/api/products/:id/video", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "products", "manage");

    const existing = await prisma.product.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound("Product");

    const product = await prisma.product.update({
      where: { id: existing.id },
      data: { video: "" },
      include: productInclude,
    });
    if (existing.video) await deleteMediaByUrl(existing.video);

    return toAdminProduct(product, await featuredIds());
  })

  /** Replace the ordered featured list — order matters on the home page. */
  .patch(
    "/admin/api/products/featured",
    async ({ body, staffCtx }) => {
      assertCan(staffCtx, "homepage", "manage");

      const products = await prisma.product.findMany({
        where: { id: { in: body.ids } },
        select: { id: true },
      });
      const known = new Set(products.map((p) => p.id));
      const missing = body.ids.filter((id) => !known.has(id));
      if (missing.length > 0) {
        throw badRequest(`Only catalog products can be featured — unknown: ${missing.join(", ")}`);
      }

      await prisma.siteConfig.update({ where: { id: 1 }, data: { featuredIds: body.ids } });
      return { featuredIds: body.ids };
    },
    { body: updateFeaturedDto },
  );
