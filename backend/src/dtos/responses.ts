/**
 * Response DTOs — the declared output contract of the API, matching the
 * frontend types in BACKEND.md. The mappers in lib/serialize.ts are annotated
 * with these, so a serializer drifting from the contract is a compile error
 * instead of a surprise for the storefront. Status/category fields stay
 * `string` here because the DB stores plain strings; inputs are narrowed at
 * the edge by the request DTOs.
 */

/** A "buy N+, save X%" tier — see rules.ts `bestQuantityOffer`. */
export interface QuantityOfferDto {
  minQty: number;
  percentage: number;
}

/** A "buy N+, X% off delivery" tier — see rules.ts `deliveryDiscountPercent`.
 *  100 means the line ships free at that quantity. */
export interface FreeDeliveryOfferDto {
  minQty: number;
  percentage: number;
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
  minDp: number;
  onSale: boolean;
  salePercentage: number;
  salePrice: number; // price after discount; equals price when onSale is false
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
  available: number;
  inStock: boolean;
}

export interface AdminProductDto extends PublicProductDto {
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
  status: string;
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
  status: string;
  createdAt: string;
}

/** GET /admin/api/orders — the list row, with fulfilment accountability. */
export interface AdminOrderDto extends OrderDto {
  preparedById: string | null;
  preparedBy: string | null; // Staff.name at read time, null when unclaimed
  invoiceId: string | null;
  invoiceStatus: string | null;
  warrantyCount: number;
}

/** One entry in an order's audit trail. */
export interface OrderEventDto {
  id: string;
  at: string;
  kind: string;
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
  status: string;
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
  status: string;
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

/** A signed-in customer's synced cart — GET/PUT /api/cart. */
export interface CartDto {
  items: { productId: string; qty: number }[];
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
  city: string;
  phone: string;
  notes: string;
  status: string;
  createdAt: string;
}

/** One poster in a hero's rotation. */
export interface HeroPosterDto {
  id: string;
  image: string;
  alt: string;
  href: string;
  sort: number;
}

/** A page's hero art. Served to both the storefront and the admin — there is
 *  nothing staff-only about it, so one shape covers both. */
export interface PageHeroDto {
  pageKey: string;
  mode: string; // "plain" | "image" | "posters"
  background: string;
  overlay: number;
  posters: HeroPosterDto[];
}

/** A campaign page as the admin list renders it. `productName`/`productSlug`
 *  are resolved for display; `productVisible` lets the admin flag pages whose
 *  product is off-catalogue (sold *only* here). */
export interface LandingPageDto {
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
  createdAt: string;
  updatedAt: string;
}

/** GET /api/landing-pages/:slug — the public campaign payload. Carries the
 *  full product so /lp/:slug needs no second call, which also means an
 *  off-catalogue product renders even though GET /api/products/:slug 404s. */
export interface PublicLandingPageDto {
  /** Already resolved — the internal title never reaches this payload. */
  headline: string;
  slug: string;
  offerPrice: number;
  compareAtPrice: number;
  /** Derived server-side so the page and the ad creative can't disagree. */
  discountPercentage: number;
  /** compareAtPrice − offerPrice, 0 when there's nothing to compare against.
   *  Derived here for the same reason: the page renders it, never recomputes it. */
  youSave: number;
  ribbonText: string;
  buttonLabel: string;
  footerNote: string;
  benefitBullets: string[];
  imageHint: string;
  gtmId: string;
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
  status: string;
  createdAt: string;
}

export interface SlideDto {
  id: string;
  image: string | null;
  cta: string;
  href: string;
  active: boolean;
  fit: string;
  bg: string;
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
}

export type IndustrialServiceDto = ServiceDto;

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
  status: string;
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
  kind: string;
  provider: string;
  providers: string[];
  enabled: boolean;
  environment: string;
  apiKey: string;
  apiSecret: string;
  webhookUrl: string;
  isGateway: boolean;
}
