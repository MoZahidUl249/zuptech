import type {
  AdminOrderDto,
  AdminOrderItemDto,
  AdminProductDto,
  CategoryDto,
  CheckoutOrderDto,
  ContactMessageDto,
  CustomerDto,
  CustomerProfileDto,
  IndustrialLeadDto,
  IndustrialServiceDto,
  InvoiceDto,
  LandingPageDto,
  LeadDto,
  OrderDetailDto,
  OrderDto,
  OrderEventDto,
  PaymentMethodDto,
  PublicLandingPageDto,
  PublicProductDto,
  PurchaseOrderDto,
  QuoteDto,
  SectionDto,
  ServiceDto,
  ShowcaseCardDto,
  SlideDto,
  StockMovementDto,
  SupplierDto,
  TeamMemberDto,
  WarrantyDto,
} from "../dtos/responses";
import type {
  Category,
  ContactMessage,
  Customer,
  FreeDeliveryOffer,
  HeroSlide,
  IndustrialLead,
  IndustrialService,
  Invoice,
  LandingPage,
  LandingPageTier,
  Order,
  OrderEvent,

  OrderItem,
  PaymentMethod,
  Product,
  PurchaseOrder,
  QuantityOffer,
  Section,
  Service,
  ServiceLead,
  ShowcaseCard,
  Staff,
  StockMovement,
  Supplier,
  TeamMember,
  Warranty,
} from "../generated/client";
import type { PricedCart } from "./pricing";
import {
  availableStock,
  coerceTo,
  HERO_MEDIA_TYPES,
  INDUSTRIAL_LEAD_STATUSES,
  INVOICE_STATUSES,
  isLowStock,
  campaignUnitPrice,
  HERO_PAGES,
  type HeroPage,
  LEAD_STATUSES,
  maskSecret,
  ORDER_EVENT_KINDS,
  parseOrderStatus,
  PAYMENT_ENVIRONMENTS,
  PAYMENT_KINDS,
  PO_STATUSES,
  salePriceFrom,
  sellingPrice,
  stockTagFor,
  SERVICE_BULLET_STYLES,
  SERVICE_IMAGE_SIDES,
  WARRANTY_STATUSES,
} from "./rules";

/**
 * DB row → API payload mappers. Every response goes through one of these so
 * each audience only ever sees its own fields (customers never see cost or
 * gateway secrets; admins see everything except raw secrets). Return types
 * are pinned to the response DTOs in dtos/responses.ts.
 */

/**
 * The relations every product mapper needs loaded. Spread into the `include`
 * of any product query — `toPublicProduct` can't be called without it.
 */
export const productInclude = {
  quantityOffers: { orderBy: { minQty: "asc" as const } },
  freeDeliveryOffers: { orderBy: { minQty: "asc" as const } },
  category: { include: { section: true } },
  /*
   * A yes/no: does this product have stock on the way?
   *
   * Feeds the "Incoming" status tag (`stockTagFor` in lib/rules.ts). Written
   * as narrowly as the question allows — `take: 1` and `select: id`, filtered
   * in the database — because this rides along with GET /api/products, and the
   * index comment on Product records what an unbounded query costs on that
   * route. Backed by PurchaseOrder(productId, status).
   *
   * Note it deliberately does NOT return the purchase orders themselves: they
   * are inventory internals and must never reach the public DTO.
   */
  purchaseOrders: {
    where: { status: "In transit" },
    select: { id: true },
    take: 1,
  },
};

/** A product row with `productInclude` applied. */
export type ProductWithRelations = Product & {
  quantityOffers: QuantityOffer[];
  freeDeliveryOffers: FreeDeliveryOffer[];
  category: Category & { section: Section };
  /** At most one row — the "is anything on the way" probe, not a history. */
  purchaseOrders: { id: string }[];
};

/** Storefront view — no cost/stock internals, just what the shop renders. */
export function toPublicProduct(p: ProductWithRelations): PublicProductDto {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    categoryId: p.categoryId,
    category: p.category.name,
    categoryLogo: p.category.svgLogo,
    section: p.category.section.name,
    price: p.price,
    minDepositPct: p.minDepositPct,
    onSale: p.onSale,
    salePrice: sellingPrice(p),
    quantityOffers: p.quantityOffers.map((o) => ({ minQty: o.minQty, amount: o.amount })),
    deliveryFeeInsideDhaka: p.deliveryFeeInsideDhaka,
    deliveryFeeOutsideDhaka: p.deliveryFeeOutsideDhaka,
    installationFeeInsideDhaka: p.installationFeeInsideDhaka,
    installationFeeOutsideDhaka: p.installationFeeOutsideDhaka,
    freeDeliveryOffers: p.freeDeliveryOffers.map((o) => ({
      minQty: o.minQty,
      amount: o.amount,
    })),
    rating: p.rating,
    sold: p.sold,
    imgHint: p.imgHint,
    specs: p.specs,
    description: p.description,
    video: p.video,
    photos: p.photos,
    recommendedIds: p.recommendedIds,
    salePct: p.salePct,
    // Resolved here, not on the client: the manual override and the stock
    // derivation are both server facts, and the card should only ever print
    // the answer.
    stockTag: stockTagFor(p, p.purchaseOrders.length > 0),
    available: availableStock(p),
    inStock: availableStock(p) > 0,
  };
}

/** Admin view — everything, plus derived stock flags the panel displays. */
export function toAdminProduct(
  p: ProductWithRelations,
  featuredIds: string[],
): AdminProductDto {
  return {
    ...toPublicProduct(p),
    stockTagOverride: p.stockTag,
    sku: p.sku,
    cost: p.cost,
    stock: p.stock,
    reserved: p.reserved,
    reorderAt: p.reorderAt,
    visible: p.visible,
    featured: featuredIds.includes(p.id),
    lowStock: isLowStock(p),
    stockValue: p.cost * p.stock,
    warrantyMonths: p.warrantyMonths,
  };
}

/**
 * ⚠️ Shared with the customer-facing GET /api/my/orders — never add staff-only
 * fields here. They belong on `toAdminOrder` below.
 */
export function toOrder(o: Order & { items: OrderItem[] }): OrderDto {
  return {
    id: o.id,
    customer: o.name,
    phone: o.phone,
    address: o.address,
    insideDhaka: o.insideDhaka,
    items: o.items.map((i) => ({
      productId: i.productId,
      qty: i.qty,
      unitPrice: i.unitPrice,
      deliveryFee: i.deliveryFee,
      installationFee: i.installationFee,
    })),
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    installationFee: o.installationFee,
    total: o.total,
    pay: o.pay,
    status: parseOrderStatus(o.status),
    createdAt: o.createdAt.toISOString(),
  };
}

/* ===== Order accountability: prepared-by, audit trail, invoice, warranty ===== */

/** The relations `toAdminOrder` needs. Spread into the admin list query. */
export const adminOrderInclude = {
  items: true,
  preparedBy: true,
  invoice: true,
  _count: { select: { warranties: true } },
};

type AdminOrderRow = Order & {
  items: OrderItem[];
  preparedBy: Staff | null;
  invoice: Invoice | null;
  _count: { warranties: number };
};

/** GET /admin/api/orders row — the customer payload plus fulfilment state. */
export function toAdminOrder(o: AdminOrderRow): AdminOrderDto {
  return {
    ...toOrder(o),
    preparedById: o.preparedById,
    preparedBy: o.preparedBy?.name ?? null,
    invoiceId: o.invoice?.id ?? null,
    invoiceStatus: o.invoice ? coerceTo(INVOICE_STATUSES, o.invoice.status, "Draft") : null,
    warrantyCount: o._count.warranties,
  };
}

type OrderItemWithProduct = OrderItem & { product: Pick<Product, "name" | "sku" | "slug"> };

/**
 * A line enriched with catalog data. `lineTotal` covers goods only — delivery
 * and installation are order-level totals on the invoice, matching how
 * lib/pricing.ts computes them.
 */
function toAdminOrderItem(i: OrderItemWithProduct): AdminOrderItemDto {
  return {
    productId: i.productId,
    qty: i.qty,
    unitPrice: i.unitPrice,
    deliveryFee: i.deliveryFee,
    installationFee: i.installationFee,
    name: i.product.name,
    sku: i.product.sku,
    slug: i.product.slug,
    lineTotal: i.unitPrice * i.qty,
  };
}

export function toOrderEvent(e: OrderEvent): OrderEventDto {
  return {
    id: e.id,
    at: e.at.toISOString(),
    kind: coerceTo(ORDER_EVENT_KINDS, e.kind, "note"),
    detail: e.detail,
    by: e.by,
    byName: e.byName,
  };
}

type InvoiceRow = Invoice & {
  issuedBy: Staff | null;
  order: Order & { items: OrderItemWithProduct[]; preparedBy: Staff | null };
};

/**
 * The invoice document. All money comes off the order, which froze it at
 * checkout — the Invoice row itself stores none, so the two can never drift.
 */
export function toInvoice(inv: InvoiceRow): InvoiceDto {
  const o = inv.order;
  return {
    id: inv.id,
    orderId: inv.orderId,
    status: coerceTo(INVOICE_STATUSES, inv.status, "Draft"),
    issuedAt: inv.issuedAt?.toISOString() ?? null,
    paidAt: inv.paidAt?.toISOString() ?? null,
    notes: inv.notes,
    issuedBy: inv.issuedBy?.name ?? null,
    createdAt: inv.createdAt.toISOString(),
    customer: o.name,
    phone: o.phone,
    address: o.address,
    pay: o.pay,
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    installationFee: o.installationFee,
    total: o.total,
    preparedBy: o.preparedBy?.name ?? null,
    items: o.items.map(toAdminOrderItem),
  };
}

type WarrantyRow = Warranty & {
  product: Pick<Product, "name">;
  order: Pick<Order, "name" | "phone">;
};

export function toWarranty(w: WarrantyRow): WarrantyDto {
  return {
    id: w.id,
    orderId: w.orderId,
    orderItemId: w.orderItemId,
    productId: w.productId,
    productName: w.product.name,
    sku: w.sku,
    qty: w.qty,
    serialNo: w.serialNo,
    months: w.months,
    startsAt: w.startsAt.toISOString(),
    endsAt: w.endsAt.toISOString(),
    status: coerceTo(WARRANTY_STATUSES, w.status, "Active"),
    claimNote: w.claimNote,
    customer: w.order.name,
    phone: w.order.phone,
  };
}

type OrderDetailRow = Order & {
  items: OrderItemWithProduct[];
  preparedBy: Staff | null;
  invoice: (Invoice & { issuedBy: Staff | null }) | null;
  warranties: WarrantyRow[];
  events: OrderEvent[];
  _count: { warranties: number };
};

/** GET /admin/api/orders/:id — everything one order screen needs, in one call. */
export function toOrderDetail(o: OrderDetailRow): OrderDetailDto {
  return {
    ...toAdminOrder(o),
    items: o.items.map(toAdminOrderItem),
    events: o.events.map(toOrderEvent),
    invoice: o.invoice ? toInvoice({ ...o.invoice, order: o }) : null,
    warranties: o.warranties.map(toWarranty),
  };
}

export function toCustomer(c: Customer & { _count: { orders: number } }): CustomerDto {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    orders: c._count.orders,
    joined: c.joinedAt.toISOString(),
  };
}

/** Self-service profile — GET/PATCH /api/me. */
export function toCustomerProfile(c: Customer): CustomerProfileDto {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email ?? "",
    address: c.address,
    insideDhaka: c.insideDhaka,
  };
}

/** Leads always carry their service — `service` is the resolved name, so the
 *  admin table keeps rendering a plain string as it always did. */
export function toLead(l: ServiceLead & { service: Service }): LeadDto {
  return {
    id: l.id,
    serviceId: l.serviceId,
    service: l.service.name,
    customer: l.customer,
    address: l.address,
    phone: l.phone,
    email: l.email,
    notes: l.notes,
    status: coerceTo(LEAD_STATUSES, l.status, "New"),
    createdAt: l.createdAt.toISOString(),
  };
}

/** Takes the row alone — unlike toLead, the service label is denormalized onto
 *  IndustrialLead.serviceName, so no relation needs loading. */
export function toIndustrialLead(l: IndustrialLead): IndustrialLeadDto {
  return {
    id: l.id,
    serviceId: l.industrialServiceId,
    service: l.serviceName,
    company: l.company,
    contactName: l.contactName,
    designation: l.designation,
    phone: l.phone,
    email: l.email,
    sector: l.sector,
    scope: l.scope,
    timeline: l.timeline,
    siteLocation: l.siteLocation,
    load: l.load,
    budget: l.budget,
    notes: l.notes,
    status: coerceTo(INDUSTRIAL_LEAD_STATUSES, l.status, "New"),
    createdAt: l.createdAt.toISOString(),
  };
}

/* ===== Landing pages ===== */

/** The relations both landing-page mappers need loaded. Ordered so the admin
 *  editor, the public ladder and the pricing resolver all see one sequence
 *  without three sorts. */
export const landingPageInclude = {
  product: { include: productInclude },
  tiers: { orderBy: { minQty: "asc" as const } },
};

type LandingPageRow = LandingPage & {
  product: ProductWithRelations;
  tiers: LandingPageTier[];
};

/** One slide of a campaign's "what's in the box" gallery. */
export type CampaignGalleryItem = { url: string; kind: "image" | "video"; alt: string };

/**
 * Coerce a stored `galleryItems` column to the shape the page renders.
 *
 * Exported because the upload routes read the current list through this too —
 * one coercion, so the route and the payload can never disagree about what is
 * already stored.
 *
 * Items with no url are DROPPED rather than emptied: a hand-edited row must
 * not be able to hand next/image a `src` of "", which throws, where an empty
 * feature title merely renders nothing. Anything that is not "video" is an
 * image, so an unrecognised kind degrades to the safe branch.
 */
export function campaignGallery(value: unknown): CampaignGalleryItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((o): o is Record<string, unknown> => Boolean(o) && typeof o === "object")
    .map((o) => ({
      url: typeof o.url === "string" ? o.url : "",
      kind: o.kind === "video" ? ("video" as const) : ("image" as const),
      alt: typeof o.alt === "string" ? o.alt : "",
    }))
    .filter((m) => m.url !== "");
}

/**
 * The campaign content block, shared by the admin and public payloads.
 *
 * Json columns come back as Prisma.JsonValue, so each repeatable is coerced to
 * the shape the page renders rather than trusted — a hand-edited row in the
 * database must not be able to crash the campaign it is attached to.
 */
function campaignContent(lp: LandingPageRow) {
  const list = <T>(v: unknown, pick: (o: Record<string, unknown>) => T): T[] =>
    Array.isArray(v) ? v.filter((o) => o && typeof o === "object").map((o) => pick(o as Record<string, unknown>)) : [];
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const labels = (lp.formLabels ?? {}) as Record<string, unknown>;

  return {
    // The whole palette, on both the admin and the public payload — the admin
    // previews the page with the same values it renders with.
    colorHeroBg: lp.colorHeroBg,
    colorHeroText: lp.colorHeroText,
    colorBandBg: lp.colorBandBg,
    colorBandText: lp.colorBandText,
    colorTintBg: lp.colorTintBg,
    colorPageBg: lp.colorPageBg,
    colorPageText: lp.colorPageText,
    colorAccent: lp.colorAccent,
    colorHighlight: lp.colorHighlight,
    colorCtaBg: lp.colorCtaBg,
    colorCtaText: lp.colorCtaText,
    productRowIds: lp.productRowIds,
    priceCompareLabel: lp.priceCompareLabel,
    priceOfferLabel: lp.priceOfferLabel,
    hotlineLabel: lp.hotlineLabel,
    hotlineNumber: lp.hotlineNumber,
    headerCtaLabel: lp.headerCtaLabel,
    trustBadges: lp.trustBadges,
    subheadline: lp.subheadline,
    discountBadge: lp.discountBadge,
    heroCtaNote: lp.heroCtaNote,
    brandStripTitle: lp.brandStripTitle,
    brandLogos: lp.brandLogos,
    heroVideoUrl: lp.heroVideoUrl,
    videoTitle: lp.videoTitle,
    videoUrl: lp.videoUrl,
    galleryItems: campaignGallery(lp.galleryItems),
    featuresTitle: lp.featuresTitle,
    features: list(lp.features, (o) => ({ title: str(o.title), body: str(o.body) })),
    specTitle: lp.specTitle,
    specMeta: lp.specMeta,
    specs: list(lp.specs, (o) => ({ value: str(o.value), label: str(o.label) })),
    bundlesTitle: lp.bundlesTitle,
    bundlesSubtitle: lp.bundlesSubtitle,
    bundleUnitLabel: lp.bundleUnitLabel,
    bundleMaxQty: lp.bundleMaxQty,
    qcTitle: lp.qcTitle,
    qcBody: lp.qcBody,
    qcPoints: lp.qcPoints,
    qcImage: lp.qcImage,
    qcImages: lp.qcImages,
    qcImageHint: lp.qcImageHint,
    countdownTitle: lp.countdownTitle,
    countdownNote: lp.countdownNote,
    countdownEndsAt: lp.countdownEndsAt ? lp.countdownEndsAt.toISOString() : "",
    countdownCtaLabel: lp.countdownCtaLabel,
    countdownAssurance: lp.countdownAssurance,
    testimonialsTitle: lp.testimonialsTitle,
    testimonials: list(lp.testimonials, (o) => ({
      quote: str(o.quote), name: str(o.name), location: str(o.location),
    })),
    formTitle: lp.formTitle,
    formIntro: lp.formIntro,
    formLabels: {
      name: str(labels.name),
      phone: str(labels.phone),
      address: str(labels.address),
      packageLabel: str(labels.packageLabel),
      deliveryLabel: str(labels.deliveryLabel),
      totalLabel: str(labels.totalLabel),
      submit: str(labels.submit),
      namePlaceholder: str(labels.namePlaceholder),
      phonePlaceholder: str(labels.phonePlaceholder),
      addressPlaceholder: str(labels.addressPlaceholder),
      successMessage: str(labels.successMessage),
    },
    footerTagline: lp.footerTagline,
    footerAbout: lp.footerAbout,
    footerLines: lp.footerLines,
  };
}

/**
 * Orders attributed to a campaign, counted from the Order rows themselves.
 *
 * Passed in rather than read here because the admin list resolves them for
 * every campaign in one groupBy — a per-row query would be one round trip per
 * campaign on a screen whose whole job is comparing campaigns.
 *
 * Absent means "not measured on this call" and shows as zero, which is honest:
 * the single-campaign GET does not run the aggregate.
 */
export interface LandingPageStats {
  orderCount: number;
  revenue: number;
}

export function toLandingPage(
  lp: LandingPageRow,
  stats: LandingPageStats = { orderCount: 0, revenue: 0 },
): LandingPageDto {
  return {
    id: lp.id,
    title: lp.title,
    headline: lp.headline,
    slug: lp.slug,
    productId: lp.productId,
    productName: lp.product.name,
    productSlug: lp.product.slug,
    // Surfaced so the admin can mark pages whose product is off-catalogue —
    // for those, unpublishing this page also removes the only way to buy it.
    productVisible: lp.product.visible,
    productSellingPrice: sellingPrice(lp.product),
    /* Mapped rather than passed through so the row's `id`/`landingPageId`
       never reach the editor, which would only send them back. */
    tiers: lp.tiers.map(({ minQty, unitPrice }) => ({ minQty, unitPrice })),
    offerPrice: lp.offerPrice,
    compareAtPrice: lp.compareAtPrice,
    ribbonText: lp.ribbonText,
    buttonLabel: lp.buttonLabel,
    footerNote: lp.footerNote,
    benefitBullets: lp.benefitBullets,
    imageHint: lp.imageHint,
    gtmId: lp.gtmId,
    published: lp.published,
    ...campaignContent(lp),
    viewCount: lp.viewCount,
    orderCount: stats.orderCount,
    /** BDT actually ordered through this campaign — order totals, summed. */
    revenue: stats.revenue,
    createdAt: lp.createdAt.toISOString(),
    updatedAt: lp.updatedAt.toISOString(),
  };
}

/** Public campaign payload. Carries the whole product so /lp/:slug renders
 *  from one call — including products GET /api/products/:slug would 404. */
export function toPublicLandingPage(lp: LandingPageRow): PublicLandingPageDto {
  return {
    // Resolved here, not in the page: the internal admin name must never
    // be serialized into a public payload at all.
    headline: lp.headline.trim() || lp.product.name,
    slug: lp.slug,
    offerPrice: lp.offerPrice,
    compareAtPrice: lp.compareAtPrice,
    youSave: Math.max(0, lp.compareAtPrice - lp.offerPrice),
    ribbonText: lp.ribbonText,
    buttonLabel: lp.buttonLabel,
    footerNote: lp.footerNote,
    benefitBullets: lp.benefitBullets,
    imageHint: lp.imageHint,
    gtmId: lp.gtmId,
    ...campaignContent(lp),
    /* The bundle ladder, priced from stored rows rather than typed as copy —
     * the campaign's own tiers when it has any, the product's quantity offers
     * when it does not. Built with campaignUnitPrice(), which is the same
     * function priceCart() charges through, so the number the ad shows and the
     * number the cart takes cannot drift. */
    bundles: Array.from({ length: Math.max(1, lp.bundleMaxQty) }, (_, i) => {
      const qty = i + 1;
      const unit = campaignUnitPrice(lp.product, qty, lp.product.quantityOffers, lp.tiers);
      return {
        qty,
        unitPrice: unit,
        total: unit * qty,
        wasTotal: sellingPrice(lp.product) * qty,
        saving: Math.max(0, (sellingPrice(lp.product) - unit) * qty),
      };
    }),
    product: toPublicProduct(lp.product),
  };
}

export function toMessage(m: ContactMessage): ContactMessageDto {
  return {
    id: m.id,
    name: m.name,
    phone: m.phone,
    email: m.email,
    message: m.message,
    read: m.read,
    createdAt: m.createdAt.toISOString(),
  };
}

export function toSlide(s: HeroSlide): SlideDto {
  return {
    id: s.id,
    image: s.image,
    cta: s.cta,
    href: s.href,
    active: s.active,
    // The column is a free string, so a legacy or hand-edited row could hold
    // anything; fall back to the schema default rather than emitting a value
    // the storefront has no branch for.
    fit: s.fit === "contain" ? "contain" : "cover",
    mediaType: coerceTo(HERO_MEDIA_TYPES, s.mediaType, "image"),
    bg: s.bg,
    // Same defensive read as `fit`: the column is a free text array, so drop
    // anything that isn't a page the storefront actually renders. A slide left
    // with no valid page is parked rather than shown everywhere.
    pages: (s.pages ?? []).filter((p): p is HeroPage =>
      (HERO_PAGES as readonly string[]).includes(p),
    ),
  };
}

export function toService(s: Service): ServiceDto {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    dsc: s.dsc,
    image: s.image,
    features: s.features,
    sort: s.sort,
    imageSide: coerceTo(SERVICE_IMAGE_SIDES, s.imageSide, "left"),
    bulletStyle: coerceTo(SERVICE_BULLET_STYLES, s.bulletStyle, "tick"),
  };
}

/** A person on the contact page. */
export function toTeamMember(m: TeamMember): TeamMemberDto {
  return {
    id: m.id,
    name: m.name,
    role: m.role,
    bio: m.bio,
    photo: m.photo,
    sort: m.sort,
  };
}

/** The home page's showcase cards. Same projection as a service card — the
 *  storefront renders them through the same component — but a different table,
 *  which is the entire point of the model. */
export function toShowcaseCard(c: ShowcaseCard): ShowcaseCardDto {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    dsc: c.dsc,
    image: c.image,
    features: c.features,
    sort: c.sort,
    imageSide: coerceTo(SERVICE_IMAGE_SIDES, c.imageSide, "left"),
    bulletStyle: coerceTo(SERVICE_BULLET_STYLES, c.bulletStyle, "tick"),
  };
}

/** Structurally identical to toService — kept separate so the two catalogues
 *  can diverge without touching each other's callers. */
export function toIndustrialService(s: IndustrialService): IndustrialServiceDto {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    dsc: s.dsc,
    image: s.image,
    features: s.features,
    sort: s.sort,
    imageSide: coerceTo(SERVICE_IMAGE_SIDES, s.imageSide, "left"),
    bulletStyle: coerceTo(SERVICE_BULLET_STYLES, s.bulletStyle, "tick"),
  };
}

export function toCategory(c: Category & { section: Section }): CategoryDto {
  return {
    id: c.id,
    name: c.name,
    svgLogo: c.svgLogo,
    sectionId: c.sectionId,
    section: c.section.name,
  };
}

export function toSection(s: Section & { categories: Category[] }): SectionDto {
  return {
    id: s.id,
    name: s.name,
    categories: s.categories.map((c) => toCategory({ ...c, section: s })),
  };
}

export function toSupplier(s: Supplier & { _count?: { purchaseOrders: number } }): SupplierDto {
  return {
    id: s.id,
    name: s.name,
    contact: s.contact,
    phone: s.phone,
    items: s.items,
  };
}

export function toPurchaseOrder(po: PurchaseOrder): PurchaseOrderDto {
  return {
    id: po.id,
    supplierId: po.supplierId,
    productId: po.productId,
    qty: po.qty,
    value: po.value,
    eta: po.eta.toISOString(),
    status: coerceTo(PO_STATUSES, po.status, "Confirmed"),
  };
}

export function toMovement(m: StockMovement): StockMovementDto {
  return {
    id: m.id,
    date: m.date.toISOString(),
    sku: m.sku,
    change: m.change,
    reason: m.reason,
    by: m.by,
  };
}

/**
 * Admin payments view: gateway credentials are write-only, responses carry a
 * mask. Both fields, not just the one named "secret" — a gateway API key is a
 * credential too, and it was going out in full to anyone with `payments: view`.
 */
export function toPaymentMethod(m: PaymentMethod): PaymentMethodDto {
  return {
    id: m.id,
    name: m.name,
    kind: coerceTo(PAYMENT_KINDS, m.kind, "Offline"),
    provider: m.provider,
    providers: m.providers,
    enabled: m.enabled,
    environment: coerceTo(PAYMENT_ENVIRONMENTS, m.environment, "Test"),
    apiKey: maskSecret(m.apiKey),
    apiSecret: maskSecret(m.apiSecret),
    webhookUrl: m.webhookUrl,
    isGateway: m.isGateway,
  };
}

/** Priced cart → the quote contract (cal-bk.md §2.1). */
export function toQuote(cart: PricedCart): QuoteDto {
  return {
    lines: cart.lines.map((l) => ({
      productId: l.product.id,
      qty: l.qty,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
      deliveryFee: l.deliveryFee,
      installationFee: l.installationFee,
    })),
    subtotal: cart.subtotal,
    deliveryFee: cart.deliveryFee,
    installationFee: cart.installationFee,
    total: cart.total,
    insideDhaka: cart.insideDhaka,
  };
}

/** Checkout response (cal-bk.md §2.2) — richer than OrderDto: the
 *  confirmation screen renders orderId/summary/lineTotal/epoch-ms directly. */
export function toCheckoutOrder(o: Order & { items: OrderItem[] }, summary: string): CheckoutOrderDto {
  return {
    orderId: o.id,
    status: parseOrderStatus(o.status),
    items: o.items.map((i) => ({
      productId: i.productId,
      qty: i.qty,
      unitPrice: i.unitPrice,
      lineTotal: i.unitPrice * i.qty,
      deliveryFee: i.deliveryFee,
      installationFee: i.installationFee,
    })),
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    installationFee: o.installationFee,
    total: o.total,
    summary,
    pay: o.pay,
    phone: o.phone,
    address: o.address,
    insideDhaka: o.insideDhaka,
    createdAt: o.createdAt.getTime(),
  };
}
