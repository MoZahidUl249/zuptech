/**
 * Response DTOs — the declared output contract of the API, matching the
 * frontend types in BACKEND.md. The mappers in lib/serialize.ts are annotated
 * with these, so a serializer drifting from the contract is a compile error
 * instead of a surprise for the storefront. Category fields stay `string`
 * here because the DB stores plain strings; inputs are narrowed at the edge
 * by the request DTOs.
 *
 * Order `status` is the exception: it is narrowed to `OrderStatus`, because
 * the column only ever holds one of those five values (every write goes
 * through orderStatusDto) and the storefront switches on them. Typing it
 * `string` described the column rather than the contract, and left the
 * frontend asserting a union the API never promised.
 */

import type {
  HeroMediaType,
  IndustrialLeadStatus,
  InvoiceStatus,
  LeadStatus,
  OrderEventKind,
  OrderStatus,
  PoStatus,
  ServiceBulletStyle,
  ServiceImageSide,
  WarrantyStatus,
} from "../lib/rules";

/** A "buy N+, take ৳X off each unit" tier — see rules.ts `bestQuantityOffer`. */
export interface QuantityOfferDto {
  minQty: number;
  amount: number;
}

/** A "buy N+, take ৳X off delivery" tier — see rules.ts
 *  `deliveryDiscountAmount`. An amount at or above the zone fee ships free. */
export interface FreeDeliveryOfferDto {
  minQty: number;
  amount: number;
}

export interface PublicProductDto {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  category: string; // Category.name
  categoryLogo: string; // Category.svgLogo, "" = none
  section: string; // Section.name — the storefront's top-level filter
  price: number;
  minDepositPct: number; // whole percent of price (0–100), display-only
  onSale: boolean;
  /** The admin-typed discount, 0–100. A LABEL for the card — `salePrice` is
   *  the money, and is what this percentage was already resolved into. */
  salePct: number;
  salePrice: number; // what the customer pays; equals price when not on sale
  quantityOffers: QuantityOfferDto[]; // "buy N+, save X%" tiers, ordered by minQty ascending
  deliveryFeeInsideDhaka: number; // BDT, per unit
  deliveryFeeOutsideDhaka: number; // BDT, per unit
  installationFeeInsideDhaka: number; // BDT, per unit
  installationFeeOutsideDhaka: number; // BDT, per unit
  freeDeliveryOffers: FreeDeliveryOfferDto[]; // "buy N+, X% off delivery" tiers, ordered by minQty ascending
  rating: number;
  sold: number;
  imgHint: string;
  specs: string[];
  description: string;
  video: string;
  photos: string[];
  // Curated products shown under this one, in this order. Ids only — the
  // storefront resolves them in one request rather than this endpoint
  // embedding whole products and recursing into their recommendations.
  recommendedIds: string[];
  /** Resolved status label: "" | "Out of stock" | "Incoming" | "Sold out".
   *  Already accounts for the manual override — the client just prints it. */
  stockTag: string;
  available: number;
  inStock: boolean;
}

export interface AdminProductDto extends PublicProductDto {
  /**
   * The RAW override column, as opposed to the resolved `stockTag` above.
   *
   * The admin needs both: "" here with "Out of stock" resolved means the
   * derivation produced it, and the editor should show "Auto". Sending only
   * the resolved value would make those two states indistinguishable, and
   * saving the form would silently pin a tag nobody chose.
   */
  stockTagOverride: string;
  sku: string;
  cost: number;
  stock: number;
  reserved: number;
  reorderAt: number;
  visible: boolean;
  featured: boolean;
  lowStock: boolean;
  stockValue: number;
  warrantyMonths: number; // 0 = no warranty; drives the warranty registry on delivery
}

/** One priced cart line — shared by quotes and the checkout response. */
export interface QuoteLineDto {
  productId: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  deliveryFee: number | null; // per unit; null until insideDhaka is known
  installationFee: number | null; // per unit; null until insideDhaka is known
}

/** POST /api/pricing/quote response (cal-bk.md §2.1). */
export interface QuoteDto {
  lines: QuoteLineDto[];
  subtotal: number;
  deliveryFee: number | null; // null until the delivery zone is known
  installationFee: number | null; // Σ product installation fee × qty; null until known
  total: number | null;
  insideDhaka: boolean | null; // null until the delivery zone is known
}

/** POST /api/orders response (cal-bk.md §2.2) — everything server-computed. */
export interface CheckoutOrderDto {
  orderId: string;
  status: OrderStatus;
  items: QuoteLineDto[];
  subtotal: number;
  deliveryFee: number;
  installationFee: number;
  total: number;
  summary: string;
  pay: string;
  phone: string;
  address: string; // free text + delivery zone label, e.g. "House 12, Road 7, Dhanmondi, Inside Dhaka"
  insideDhaka: boolean;
  createdAt: number; // epoch ms
}

export interface OrderItemDto {
  productId: string;
  qty: number;
  unitPrice: number;
  deliveryFee: number;
  installationFee: number;
}

/**
 * The shape both audiences share. Careful: this is what the *customer* sees at
 * GET /api/my/orders, so staff-only fields never belong here — they go on
 * AdminOrderDto below (same split as PublicProductDto / AdminProductDto).
 */
export interface OrderDto {
  id: string;
  customer: string;
  phone: string;
  address: string;
  insideDhaka: boolean;
  items: OrderItemDto[];
  subtotal: number;
  deliveryFee: number;
  installationFee: number;
  total: number;
  pay: string;
  status: OrderStatus;
  createdAt: string;
}

/** GET /admin/api/orders — the list row, with fulfilment accountability. */
export interface AdminOrderDto extends OrderDto {
  preparedById: string | null;
  preparedBy: string | null; // Staff.name at read time, null when unclaimed
  invoiceId: string | null;
  invoiceStatus: InvoiceStatus | null;
  warrantyCount: number;
}

/** One entry in an order's audit trail. */
export interface OrderEventDto {
  id: string;
  at: string;
  kind: OrderEventKind;
  detail: string;
  by: string; // staff username, or "customer"
  byName: string;
}

/** An order line enriched with catalog data, for the admin detail view. */
export interface AdminOrderItemDto extends OrderItemDto {
  name: string;
  sku: string;
  slug: string;
  lineTotal: number;
}

/** GET /admin/api/orders/:id — everything one order screen needs, in one call. */
export interface OrderDetailDto extends AdminOrderDto {
  items: AdminOrderItemDto[];
  events: OrderEventDto[];
  invoice: InvoiceDto | null;
  warranties: WarrantyDto[];
}

/**
 * Invoices derive their money from the order, so the amounts below are copies
 * for display, never a second source of truth.
 */
export interface InvoiceDto {
  id: string;
  orderId: string;
  status: InvoiceStatus;
  issuedAt: string | null;
  paidAt: string | null;
  notes: string;
  issuedBy: string | null;
  createdAt: string;
  // Derived from the order — see lib/serialize.ts `toInvoice`.
  customer: string;
  phone: string;
  address: string;
  pay: string;
  subtotal: number;
  deliveryFee: number;
  installationFee: number;
  total: number;
  preparedBy: string | null;
  items: AdminOrderItemDto[];
}

export interface WarrantyDto {
  id: string;
  orderId: string;
  orderItemId: number;
  productId: string;
  productName: string;
  sku: string;
  qty: number;
  serialNo: string;
  months: number;
  startsAt: string;
  endsAt: string;
  status: WarrantyStatus;
  claimNote: string;
  // Denormalized for the registry list, so it is searchable without a join.
  customer: string;
  phone: string;
}

export interface CustomerDto {
  id: string;
  name: string;
  phone: string;
  orders: number;
  joined: string;
}

/** The signed-in customer's own profile — GET/PATCH /api/me. Includes the
 *  saved address/zone so the storefront can prefill checkout. */
export interface CustomerProfileDto {
  id: string;
  name: string;
  phone: string;
  /** Real address the reset code goes to; "" when none is on file (guest
   *  checkout, or an account created before it was collected). */
  email: string;
  address: string;
  insideDhaka: boolean;
}

export interface ContactMessageDto {
  id: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface LeadDto {
  id: string;
  serviceId: string;
  service: string; // resolved Service.name — what the admin table renders
  customer: string;
  address: string;
  phone: string;
  email: string;
  notes: string;
  status: LeadStatus;
  createdAt: string;
}

/** A campaign page as the admin list renders it. `productName`/`productSlug`
 *  are resolved for display; `productVisible` lets the admin flag pages whose
 *  product is off-catalogue (sold *only* here). */
/**
 * Every visitor-facing string on a campaign page, shared by the admin payload
 * and the public one. Editing a campaign means editing these; none of them is
 * money.
 */
export interface CampaignContentDto {
  /** Theme — every colour the campaign page paints with. Hex, validated on
   *  write; the renderer interpolates these into `style` and trusts them. */
  colorHeroBg: string;
  colorHeroText: string;
  colorBandBg: string;
  colorBandText: string;
  colorTintBg: string;
  colorPageBg: string;
  colorPageText: string;
  colorAccent: string;
  colorHighlight: string;
  colorCtaBg: string;
  colorCtaText: string;
  /** Ordered product ids for the row above the page body. */
  productRowIds: string[];
  /** Price-band labels; blank falls back to English in the renderer. */
  priceCompareLabel: string;
  priceOfferLabel: string;
  hotlineLabel: string;
  hotlineNumber: string;
  headerCtaLabel: string;
  trustBadges: string[];
  subheadline: string;
  discountBadge: string;
  heroCtaNote: string;
  brandStripTitle: string;
  brandLogos: string[];
  heroVideoUrl: string;
  videoTitle: string;
  videoUrl: string;
  /** Ordered mixed-media gallery. `kind` is server-decided at upload time. */
  galleryItems: { url: string; kind: "image" | "video"; alt: string }[];
  featuresTitle: string;
  features: { title: string; body: string }[];
  specTitle: string;
  specMeta: string;
  specs: { value: string; label: string }[];
  bundlesTitle: string;
  bundlesSubtitle: string;
  bundleUnitLabel: string;
  bundleMaxQty: number;
  qcTitle: string;
  qcBody: string;
  qcPoints: string[];
  qcImage: string;
  /** Ordered quality-block photos; supersedes `qcImage`, now always "". */
  qcImages: string[];
  qcImageHint: string;
  countdownTitle: string;
  countdownNote: string;
  /** ISO timestamp, or "" for no deadline (copy stays, clock disappears). */
  countdownEndsAt: string;
  countdownCtaLabel: string;
  countdownAssurance: string;
  testimonialsTitle: string;
  testimonials: { quote: string; name: string; location: string }[];
  formTitle: string;
  formIntro: string;
  formLabels: {
    name: string;
    phone: string;
    address: string;
    packageLabel: string;
    deliveryLabel: string;
    totalLabel: string;
    submit: string;
    namePlaceholder: string;
    phonePlaceholder: string;
    addressPlaceholder: string;
    successMessage: string;
  };
  footerTagline: string;
  footerAbout: string;
  footerLines: string[];
}

/**
 * One row of the bundle ladder, priced from the product's quantity offers.
 *
 * Derived on the server precisely so the advertised bundle total and the total
 * priceCart() charges come from one calculation — a campaign cannot promise a
 * bundle price the cart will refuse.
 */
export interface CampaignBundleDto {
  qty: number;
  unitPrice: number;
  total: number;
  /** qty × the normal selling price, for the struck-through comparison. */
  wasTotal: number;
  saving: number;
}

export interface LandingPageDto extends CampaignContentDto {
  id: string;
  /** Internal admin name — never shown to visitors. */
  title: string;
  /** Public <h1>; "" means "use the product name". */
  headline: string;
  slug: string;
  productId: string;
  productName: string;
  productSlug: string;
  productVisible: boolean;
  /**
   * What checkout will ACTUALLY charge per unit (catalog price after any
   * product-level sale). `offerPrice` below is campaign copy — priceCart()
   * never reads it — so the admin needs both side by side to notice when an
   * ad promises a number the cart won't honour.
   */
  productSellingPrice: number;
  /** This campaign's own bulk ladder: "buy N+, pay ৳P each". Empty means the
   *  page prices exactly like the shop. Absolute prices, not discounts. */
  tiers: { minQty: number; unitPrice: number }[];
  offerPrice: number;
  compareAtPrice: number;
  ribbonText: string;
  buttonLabel: string;
  footerNote: string;
  benefitBullets: string[];
  imageHint: string;
  gtmId: string;
  published: boolean;
  viewCount: number;
  orderCount: number;
  revenue: number;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/landing-pages/:slug — the public campaign payload. Carries the
 *  full product so /lp/:slug needs no second call, which also means an
 *  off-catalogue product renders even though GET /api/products/:slug 404s. */
export interface PublicLandingPageDto extends CampaignContentDto {
  /** Already resolved — the internal title never reaches this payload. */
  headline: string;
  slug: string;
  offerPrice: number;
  compareAtPrice: number;
  /** Derived server-side so the page and the ad creative can't disagree. */
  /** compareAtPrice − offerPrice, 0 when there's nothing to compare against.
   *  Derived here for the same reason: the page renders it, never recomputes it. */
  youSave: number;
  ribbonText: string;
  buttonLabel: string;
  footerNote: string;
  benefitBullets: string[];
  imageHint: string;
  gtmId: string;
  /** The bundle ladder, already priced — see CampaignBundleDto. */
  bundles: CampaignBundleDto[];
  product: PublicProductDto;
}

/** An industrial enquiry as the admin panel renders it. `service` is the
 *  stored snapshot label, so it survives the IndustrialService row being
 *  renamed or deleted; `serviceId` is null when the link was never resolved. */
export interface IndustrialLeadDto {
  id: string;
  serviceId: string | null;
  service: string;
  company: string;
  contactName: string;
  designation: string;
  phone: string;
  email: string;
  sector: string;
  scope: string;
  timeline: string;
  siteLocation: string;
  load: string;
  budget: string;
  notes: string;
  status: IndustrialLeadStatus;
  createdAt: string;
}

export interface SlideDto {
  id: string;
  image: string | null;
  /** Whether `image` is a still or a video the hero should play inline. */
  mediaType: HeroMediaType;
  cta: string;
  href: string;
  active: boolean;
  /** Narrowed to the two values the write DTO accepts — the column is a plain
   *  string, but `updateSlidesDto` only ever admits these, and the storefront
   *  switches on them. Typing it `string` here let the response contract drift
   *  wider than either side actually supports. */
  fit: "cover" | "contain";
  bg: string;
  /** Pages this slide renders on. Typed as the union rather than string[]
   *  because `toSlide` already drops anything outside it — the consumer should
   *  not have to re-validate what the serializer guarantees. */
  pages: ("home" | "services" | "industrial")[];
}

/** Shared shape for the two service catalogues — they differ only in which
 *  list they belong to, and only Service is bookable via a lead. */
export interface ServiceDto {
  id: string;
  slug: string;
  name: string;
  dsc: string;
  image: string;
  features: string[];
  /** Display order. Exposed so the admin can reorder by swapping two rows'
   *  values — array position alone isn't enough when sort values are sparse. */
  sort: number;
  /** Which half of the 50/50 storefront card the photo takes. */
  imageSide: ServiceImageSide;
  /** The marker in front of each feature line. */
  bulletStyle: ServiceBulletStyle;
}

export type IndustrialServiceDto = ServiceDto;

/** The home page's showcase cards. Same shape, different table — the storefront
 *  renders all three catalogues through one card component. */
export type ShowcaseCardDto = ServiceDto;

/** A person on the contact page. */
export interface TeamMemberDto {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo: string;
  sort: number;
}

export interface CategoryDto {
  id: string;
  name: string;
  svgLogo: string;
  sectionId: string;
  section: string; // section name, denormalized for the storefront
}

export interface SectionDto {
  id: string;
  name: string;
  categories: CategoryDto[];
}

export interface SupplierDto {
  id: string;
  name: string;
  contact: string;
  phone: string;
  items: string;
}

export interface PurchaseOrderDto {
  id: string;
  supplierId: string;
  productId: string;
  qty: number;
  value: number;
  eta: string;
  status: PoStatus;
}

export interface StockMovementDto {
  id: string;
  date: string;
  sku: string;
  change: number;
  reason: string;
  by: string;
}

export interface PaymentMethodDto {
  id: string;
  name: string;
  kind: "Mobile wallet" | "Card gateway" | "Offline";
  provider: string;
  providers: string[];
  enabled: boolean;
  environment: "Live" | "Test";
  apiKey: string;
  apiSecret: string;
  webhookUrl: string;
  isGateway: boolean;
}
