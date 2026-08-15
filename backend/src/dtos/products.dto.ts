import { t } from "elysia";

/** Shared field set for create/update. `photos` here just carries whatever
 *  URLs are already on the product (set via the dedicated upload endpoints
 *  below, which upload to Cloudinary) — this body never
 *  receives raw file data. */
const productFields = {
  name: t.String({ minLength: 2, maxLength: 200 }),
  slug: t.String({ minLength: 2, maxLength: 200, pattern: "^[a-z0-9-]+$" }),
  // Category row id — the section is reached through it, never set directly.
  categoryId: t.String({ minLength: 1, maxLength: 50 }),
  price: t.Integer({ minimum: 0 }),
  // A whole percentage of price, capped — the ceiling is the point, since an
  // unbounded "percentage" is how a display like "340% down payment" gets in.
  // Display-only; see schema.prisma before letting anything charge from it.
  minDepositPct: t.Integer({ minimum: 0, maximum: 100 }),
  // `salePrice` is flat BDT: what the customer pays, not a discount to apply,
  // so there is no ceiling to validate against price here — sellingPrice()
  // ignores a sale price that isn't below the list price.
  onSale: t.Boolean(),
  salePrice: t.Integer({ minimum: 0 }),
  // Curated, ordered product ids shown under this product. Unvalidated against
  // the catalogue on purpose: an id that stops resolving costs one missing card
  // (getProductsByIds drops it), and rejecting the whole save because an
  // unrelated product was deleted would be worse.
  recommendedIds: t.Array(t.String({ minLength: 1, maxLength: 50 })),
  deliveryFeeInsideDhaka: t.Integer({ minimum: 0 }),
  deliveryFeeOutsideDhaka: t.Integer({ minimum: 0 }),
  installationFeeInsideDhaka: t.Integer({ minimum: 0 }),
  installationFeeOutsideDhaka: t.Integer({ minimum: 0 }),
  // 0 = no warranty. Drives the Warranty rows generated when an order that
  // contains this product is delivered (lib/warranty.ts). Optional so it isn't
  // a new required field on create — the column defaults to 0.
  warrantyMonths: t.Optional(t.Integer({ minimum: 0, maximum: 240 })),
  imgHint: t.String({ maxLength: 200 }),
  specs: t.Array(t.String({ maxLength: 300 }), { maxItems: 8 }),
  description: t.String({ maxLength: 5000 }),
  // Video link (YouTube etc.) — must be an http(s) URL; "" clears it.
  video: t.Optional(t.String({ maxLength: 500, pattern: "^$|^https?://\\S+$" })),
  sku: t.String({ minLength: 2, maxLength: 50 }),
  cost: t.Integer({ minimum: 0 }),
  reorderAt: t.Integer({ minimum: 0 }),
  visible: t.Boolean(),
  // Ordered gallery — first is the cover photo. Capped at MAX_PRODUCT_PHOTOS
  // (products.ts); maxLength here just needs to fit a storage-service URL.
  photos: t.Array(t.String({ maxLength: 2000 }), { maxItems: 12 }),
};

/** Initial on-hand/reserved counts — settable only at creation, when there's
 *  nothing to diff against yet. Every later change must go through
 *  PATCH /admin/api/stock/:productId so it leaves a StockMovement row —
 *  these are deliberately NOT in `productFields`/`updateProductDto`, or the
 *  generic product PATCH could silently change stock with no audit trail. */
const initialStockFields = {
  stock: t.Integer({ minimum: 0 }),
  reserved: t.Integer({ minimum: 0 }),
};

/** GET /api/products query — filter by category name and/or its section,
 *  e.g. ?section=Industrial&category=Solar. Both match on name, not id, so
 *  the storefront can build links straight from GET /api/sections.
 *
 *  `limit`/`offset` exist because the catalogue outgrew being a single
 *  response. Without them the route fell back to a hard cap, and since it
 *  sorted oldest-first the cap silently withheld the NEWEST products: at 4,499
 *  visible products, 3,999 of them could not be reached from the shop at all.
 *  The default is a screenful, not the whole shop. */
export const productsQueryDto = t.Object({
  section: t.Optional(t.String({ maxLength: 80 })),
  category: t.Optional(t.String({ maxLength: 80 })),
  /** Free-text match on name — server-side so search reaches past page one. */
  q: t.Optional(t.String({ maxLength: 120 })),
  /**
   * Comma-separated product ids, for a caller that already knows which rows it
   * wants and would otherwise have to walk the catalogue to find them.
   *
   * The homepage is why this exists. Its featured row renders a handful of
   * products chosen by id in SiteConfig, and it got them by asking for every
   * product and filtering client-side — one request before paging, and 23
   * parallel ones after, from every browser that opened the site. Asking for
   * the ids directly makes it one request that returns 6 rows.
   *
   * Bounded so it can't be turned into an unpaged catalogue dump: LIST_CAP
   * still applies, and the string caps at roughly a hundred cuids.
   */
  ids: t.Optional(t.String({ maxLength: 3000 })),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 200 })),
  offset: t.Optional(t.Integer({ minimum: 0 })),
});

/** One "buy N+, take ৳X off each unit" tier. Kept out of `productFields`,
 *  since it's a relation (nested Prisma write), not a plain column. */
const quantityOfferDto = t.Object({
  minQty: t.Integer({ minimum: 2, maximum: 999 }),
  amount: t.Integer({ minimum: 1 }),
});
const quantityOffersField = t.Optional(t.Array(quantityOfferDto, { maxItems: 10 }));

/** One "buy N+, take ৳X off delivery" tier — same shape and same relation
 *  handling as `quantityOfferDto`. An amount at or above the zone fee ships the
 *  line free; the clamp lives in rules.ts, not here, because the fee is
 *  per-zone and this DTO can't see it. */
const freeDeliveryOfferDto = t.Object({
  minQty: t.Integer({ minimum: 2, maximum: 999 }),
  amount: t.Integer({ minimum: 1 }),
});
const freeDeliveryOffersField = t.Optional(t.Array(freeDeliveryOfferDto, { maxItems: 10 }));

export const createProductDto = t.Object({
  id: t.Optional(t.String({ minLength: 2, maxLength: 50 })),
  ...productFields,
  ...initialStockFields,
  // `sku` stays REQUIRED here — inherited from productFields, deliberately not
  // relaxed to optional.
  //
  // It used to be optional, and the server invented `ZT-P0001` when it was
  // omitted. That number means nothing to anyone: the SKU is how the warehouse,
  // the supplier's invoice and the stock count refer to the same physical box,
  // so it has to be the code the business already uses, not one this service
  // made up. A generated placeholder is worse than a missing value, because it
  // looks like a real code until someone tries to match it against a delivery.
  quantityOffers: quantityOffersField,
  freeDeliveryOffers: freeDeliveryOffersField,
});
export const updateProductDto = t.Intersect([
  t.Partial(t.Object(productFields)),
  // Relations sit outside the t.Partial: each is optional on its own, and
  // sending one replaces that whole tier list (see routes/admin/products.ts).
  t.Object({ quantityOffers: quantityOffersField, freeDeliveryOffers: freeDeliveryOffersField }),
]);
export const updateFeaturedDto = t.Object({ ids: t.Array(t.String(), { maxItems: 20 }) });

/** Appends one photo to the gallery (multipart upload via the storage service). */
export const uploadProductPhotoDto = t.Object({
  file: t.File({ type: "image", maxSize: "8m" }),
});

export const uploadProductVideoDto = t.Object({
  file: t.File({ type: "video", maxSize: "300m" }),
});

export type ProductsQueryDto = typeof productsQueryDto.static;
export type CreateProductDto = typeof createProductDto.static;
export type UpdateProductDto = typeof updateProductDto.static;
export type QuantityOfferInputDto = typeof quantityOfferDto.static;
export type FreeDeliveryOfferInputDto = typeof freeDeliveryOfferDto.static;
export type UpdateFeaturedDto = typeof updateFeaturedDto.static;
export type UploadProductPhotoDto = typeof uploadProductPhotoDto.static;
export type UploadProductVideoDto = typeof uploadProductVideoDto.static;
