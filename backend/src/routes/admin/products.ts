import { Elysia } from "elysia";
import {
  createProductDto,
  updateFeaturedDto,
  updateProductDto,
  uploadProductPhotoDto,
  uploadProductVideoDto,
} from "../../dtos/products.dto";
import { prisma } from "../../lib/db";
import { LIST_CAP, duplicateMinQtys, salePriceFrom } from "../../lib/rules";
import { badRequest, conflict, notFound } from "../../lib/http";
import { assertCan } from "../../lib/rbac";
import { productInclude, toAdminProduct } from "../../lib/serialize";
import { deleteMediaByUrl, uploadMedia } from "../../lib/storage";
import { staffGuard } from "./guard";

/** Gallery cap — first photo is the cover; matches products.dto.ts's maxItems. */
const MAX_PRODUCT_PHOTOS = 12;

/**
 * Reject ids that aren't in the catalogue, naming them.
 *
 * Shared by the two ordered-row endpoints: both write a list of product ids
 * into SiteConfig, and a typo'd id there is a permanently blank slot on the
 * home page that nothing surfaces. Note this is deliberately NOT applied to a
 * product's own `recommendedIds` — see the DTO comment there.
 */
async function assertKnownProducts(ids: string[], verb: string): Promise<void> {
  if (ids.length === 0) return;
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const known = new Set(products.map((p) => p.id));
  const missing = ids.filter((id) => !known.has(id));
  if (missing.length > 0) {
    throw badRequest(`Only catalog products can be ${verb} — unknown: ${missing.join(", ")}`);
  }
}

async function featuredIds(): Promise<string[]> {
  const config = await prisma.siteConfig.findUniqueOrThrow({ where: { id: 1 } });
  return config.featuredIds;
}

/** Both tier ladders are keyed @@unique([productId, minQty]), so a repeated
 *  threshold is a 400 rather than a Prisma constraint error. The predicate
 *  lives in rules.ts because the campaign ladder enforces the same rule. */
function assertNoDuplicateMinQty(field: string, offers: { minQty: number }[] | undefined) {
  if (!offers) return;
  const [dupe] = duplicateMinQtys(offers);
  if (dupe !== undefined) throw badRequest(`Duplicate ${field} tier for minQty ${dupe}`);
}

export const adminProducts = new Elysia({ name: "routes/admin/products", detail: { tags: ["Admin · Products"] } })
  .use(staffGuard)

  /** Full catalog, admin shape (cost, stock, featured flag…). */
  .get("/admin/api/products", async ({ staffCtx }) => {
    assertCan(staffCtx, "products", "view");
    const [products, featured] = await Promise.all([
      // Newest first. Sorting oldest-first under the cap meant a product the
      // operator had just created was not in the list they were returned to:
      // POST answered 201, the row was absent, and creating it again produced
      // a 409 for something they could not see anywhere in the panel.
      prisma.product.findMany({ take: LIST_CAP, orderBy: { createdAt: "desc" }, include: productInclude }),
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
      // `sku` is required by the DTO now, so it is always a real value here and
      // always worth checking for a clash — it used to be conditional because
      // the field could be absent and {sku: undefined} matches every row.
      const clash = await prisma.product.findFirst({
        where: { OR: [{ id }, { slug: fields.slug }, { sku: fields.sku }] },
      });
      if (clash) throw conflict("A product with the same id, slug or SKU already exists");

      const product = await prisma.product.create({
        data: {
          ...fields,
          // The percentage is the input; the taka is stored. See salePriceFrom.
          salePrice: salePriceFrom(fields.price, fields.salePct),
          id,
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
        /*
         * Recompute the sale price only when an input actually CHANGES.
         *
         * Not "was sent" — changed. The admin form PATCHes the whole product
         * body on every save, so a presence check made `priceChanging` true
         * for an edit to the description, and the stored sale price was
         * rewritten from the rounded whole percentage every time.
         *
         * That silently repriced anything the migration backfilled. A live row
         * at 1000 with a 777 sale price backfills to 22%, deliberately keeping
         * 777; under a presence check the next unrelated save turned it into
         * salePriceFrom(1000, 22) = 780 — three taka more, from editing a
         * description. Measured, not theorised.
         *
         * Comparing against the stored row means the backfilled pair survives
         * until someone genuinely edits the price or the percentage, and then
         * the two are recomputed together and agree.
         */
        const nextPrice = fields.price ?? existing.price;
        const nextPct = fields.salePct ?? existing.salePct;
        const priceChanging =
          nextPrice !== existing.price || nextPct !== existing.salePct;

        return tx.product.update({
          where: { id: params.id },
          data: {
            ...fields,
            ...(priceChanging ? { salePrice: salePriceFrom(nextPrice, nextPct) } : {}),
            ...(quantityOffers ? { quantityOffers: { create: quantityOffers } } : {}),
            ...(freeDeliveryOffers ? { freeDeliveryOffers: { create: freeDeliveryOffers } } : {}),
          },
          include: productInclude,
        });
      });

      // `video` doubles as an uploaded-file URL and a pasted link, so swapping
      // a file for a YouTube link (or any other value) strands the old upload
      // — nothing holds its URL once the column is overwritten. Same reasoning
      // as forgetImage() when a page hero's background changes. No-ops on
      // values we didn't issue, so link→file needs no special case.
      if (fields.video !== undefined && fields.video !== existing.video) {
        await deleteMediaByUrl(existing.video);
      }

      return toAdminProduct(product, await featuredIds());
    },
    { body: updateProductDto },
  )

  /**
   * Deleting is only possible for products with no *trading* history. Anything
   * a customer or a supplier is party to — an order line, a purchase order, a
   * warranty — should be hidden instead, because those rows are the evidence
   * for money that moved and they name a product that has to keep existing.
   *
   * A StockMovement deliberately does NOT block, and is deleted with the
   * product below. It used to block, which meant one stock adjustment made a
   * product permanently undeletable: nothing had ever been bought or sold, and
   * the panel still answered "set it to Hidden instead", forever, for a row
   * created by mistake. A movement is this service's own counting ledger, and
   * counting a product nobody ever traded proves nothing once the product is
   * gone. Orders, POs and warranties are the history worth refusing over.
   *
   * The count below must name **every** relation whose foreign key is
   * `Restrict` — only QuantityOffer and FreeDeliveryOffer cascade. It used to
   * check three of the five, so a product carried by a landing page passed the
   * guard, reached `product.delete()` and came back as a 500 from Postgres
   * ("Foreign key constraint violated on the constraint:
   * `LandingPage_productId_fkey`"): an unexplained failure on the one screen
   * that could not act on it. Adding a relation to schema.prisma without adding
   * it here — to the guard or to the transaction — reintroduces exactly that.
   */
  .delete("/admin/api/products/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "products", "manage");

    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        _count: { select: { orderItems: true, warranties: true, landingPages: true } },
        // Read as rows, not a count: only a *received* PO is history. See below.
        purchaseOrders: { select: { status: true } },
      },
    });
    if (!product) throw notFound("Product");

    const { orderItems, warranties, landingPages } = product._count;
    // DELETE /admin/api/purchase-orders/:id already draws this line — a
    // Received PO is inventory history and cannot be deleted, anything else
    // can. The product guard used to refuse on *any* PO, so a single
    // **Cancelled** order for something that never arrived, and which the
    // inventory screen would happily delete on its own, made the product
    // permanently undeletable. One rule, in both places.
    const receivedPos = product.purchaseOrders.filter((po) => po.status === "Received").length;

    // Say which of them it is. "Ordered or bought in" left the operator to
    // guess between three different screens, and the counts are the difference
    // between "hide this" and "go and delete that one row".
    const blockers = [
      orderItems > 0 ? `${orderItems} order line${orderItems === 1 ? "" : "s"}` : "",
      receivedPos > 0 ? `${receivedPos} received purchase order${receivedPos === 1 ? "" : "s"}` : "",
      warranties > 0 ? `${warranties} warrant${warranties === 1 ? "y" : "ies"}` : "",
    ].filter(Boolean);
    if (blockers.length > 0) {
      throw conflict(
        `This product has ${blockers.join(", ")} behind it — set it to Hidden instead of deleting`,
      );
    }
    // A campaign page is the admin's own row, not customer history, so this one
    // says what to go and do rather than pointing at Hidden.
    if (landingPages > 0) {
      throw conflict(
        `This product is used by ${landingPages} landing page${landingPages === 1 ? "" : "s"} — delete ${landingPages === 1 ? "it" : "them"} first, or point ${landingPages === 1 ? "it" : "them"} at another product`,
      );
    }

    await prisma.$transaction(async (tx) => {
      // Both foreign keys are Restrict, so these go before the product or the
      // delete below fails. Every PO still attached here is non-Received — the
      // guard above refused otherwise — which is exactly the set the inventory
      // screen lets an operator delete one at a time.
      await tx.stockMovement.deleteMany({ where: { productId: params.id } });
      await tx.purchaseOrder.deleteMany({ where: { productId: params.id } });
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

  /* ===== Photos & video (Cloudinary, via lib/storage.ts) ===== */

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
      await assertKnownProducts(body.ids, "featured");
      await prisma.siteConfig.update({ where: { id: 1 }, data: { featuredIds: body.ids } });
      return { featuredIds: body.ids };
    },
    { body: updateFeaturedDto },
  )

  /**
   * The home page's second product row. Same contract as /featured above —
   * same guard, same ordering rule, different column.
   */
  .patch(
    "/admin/api/products/home-row",
    async ({ body, staffCtx }) => {
      assertCan(staffCtx, "homepage", "manage");
      await assertKnownProducts(body.ids, "put in the home row");
      await prisma.siteConfig.update({ where: { id: 1 }, data: { homeRowIds: body.ids } });
      return { homeRowIds: body.ids };
    },
    { body: updateFeaturedDto },
  );
