/**
 * Business rules shared across routes — the single source of truth for the
 * behaviors listed in BACKEND.md §4. Keep these in sync with the storefront.
 */

/* ===== Phone (Bangladesh) ===== */

/** Valid local mobile number after normalization: 01XXXXXXXXX. */
export const PHONE_RE = /^01\d{9}$/;

/** Strip spaces/dashes so "01712-345 678" and "01712345678" compare equal. */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

export function isValidPhone(raw: string): boolean {
  return PHONE_RE.test(normalizePhone(raw));
}

/** Deterministic placeholder email Better Auth stores for a phone-only
 *  customer account — never emailed anywhere, just an internal identifier. */
export function customerEmail(phone: string): string {
  return `${phone}@customers.zuptech.local`;
}

/* ===== Category logos ===== */

/**
 * Category logos are stored as SVG *markup*, not as files on the media-storage
 * service — that service only accepts raster formats and rasterizes what it
 * stores, which would defeat the point of a vector logo.
 *
 * The storefront renders this markup inline (dangerouslySetInnerHTML), so it
 * is an XSS sink: everything below exists to make sure only inert drawing
 * markup ever reaches the column. Anything active is rejected outright rather
 * than stripped, so whoever is pasting the logo sees why it was refused
 * instead of silently saving a half-neutered file.
 */
export const MAX_SVG_LOGO_BYTES = 32 * 1024;

const SVG_ROOT_RE = /^<svg[\s>]/i;
/** Active content: script/style (url(), @import), embedded HTML, external
 *  entity plumbing, event handlers, and script-bearing URL schemes. */
const SVG_FORBIDDEN: [RegExp, string][] = [
  [/<\s*script\b/i, "<script> is not allowed"],
  [/<\s*style\b/i, "<style> is not allowed — use presentation attributes"],
  [/<\s*foreignObject\b/i, "<foreignObject> is not allowed"],
  [/<\s*(iframe|embed|object|audio|video|animate|set)\b/i, "embedded/animated content is not allowed"],
  [/<!\s*(DOCTYPE|ENTITY)\b/i, "DOCTYPE/ENTITY declarations are not allowed"],
  [/\son[a-z]+\s*=/i, "event handler attributes (onclick, onload, …) are not allowed"],
  [/(href|xlink:href|src)\s*=\s*["']?\s*(javascript|data|vbscript):/i, "script/data URLs are not allowed"],
  [/(href|xlink:href|src)\s*=\s*["']?\s*(https?:)?\/\//i, "external references are not allowed — inline the artwork"],
];

/**
 * Validate SVG logo markup, returning the value to store. Throws a plain
 * Error with a human-readable reason; routes turn that into a 400.
 */
export function sanitizeSvgLogo(raw: string): string {
  // Strip the noise editors add above the root: XML prolog and comments.
  const svg = raw
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();

  if (!svg) return "";
  if (Buffer.byteLength(svg, "utf8") > MAX_SVG_LOGO_BYTES) {
    throw new Error(`Logo must be under ${MAX_SVG_LOGO_BYTES / 1024}KB`);
  }
  // Active-content checks run before the shape check so that markup like a
  // DOCTYPE/ENTITY preamble is reported for what it is, rather than as a
  // generic "not an <svg>" — the rejection is the same either way.
  for (const [pattern, reason] of SVG_FORBIDDEN) {
    if (pattern.test(svg)) throw new Error(reason);
  }
  if (!SVG_ROOT_RE.test(svg) || !/<\/svg>\s*$/i.test(svg)) {
    throw new Error("Logo must be a single <svg> element");
  }
  return svg;
}

/* ===== Stock ===== */

interface StockLike {
  stock: number;
  reserved: number;
  reorderAt: number;
}

/** Units a customer can actually buy right now (never negative). */
export function availableStock(p: StockLike): number {
  return Math.max(p.stock - p.reserved, 0);
}

export function isLowStock(p: StockLike): boolean {
  return p.stock > 0 && p.stock <= p.reorderAt;
}

/** Suggested qty for the one-click "Reorder" action in the admin panel. */
export function reorderQty(p: StockLike): number {
  return Math.max(p.reorderAt * 2 - p.stock, p.reorderAt);
}

/* ===== Payments / integrations ===== */

export const GTM_ID_RE = /^GTM-[A-Z0-9]{4,10}$/;

/** How a stored secret is presented to admins: last 4 chars only. */
export function maskSecret(secret: string): string {
  return secret ? `••••${secret.slice(-4)}` : "";
}

/** True when a client-submitted secret is the mask we sent (i.e. unchanged). */
export function isMaskedSecret(value: string): boolean {
  return value.startsWith("••••");
}

/* ===== Money ===== */

/** Deposit due when checkout takes down payments: ceil(price × minDp / 100). */
export function minDownPayment(price: number, minDp: number): number {
  return Math.ceil((price * minDp) / 100);
}

/** Effective unit price after an active sale discount (rounded down). */
export function salePrice(p: { price: number; onSale: boolean; salePercentage: number }): number {
  return p.onSale ? p.price - Math.floor((p.price * p.salePercentage) / 100) : p.price;
}

/** True once a line's qty unlocks the product's free-delivery threshold
 *  (0 = disabled). */
export function isDeliveryFree(p: { freeDeliveryMinQty: number }, qty: number): boolean {
  return p.freeDeliveryMinQty > 0 && qty >= p.freeDeliveryMinQty;
}

interface QuantityOfferLike {
  minQty: number;
  percentage: number;
}

/** Best (highest-threshold) tier the given qty qualifies for, or null. */
export function bestQuantityOffer<T extends QuantityOfferLike>(
  offers: T[],
  qty: number,
): T | null {
  let best: T | null = null;
  for (const offer of offers) {
    if (qty >= offer.minQty && (!best || offer.minQty > best.minQty)) best = offer;
  }
  return best;
}

/** Effective unit price: the cheaper of the flat sale price and the best
 *  qty-tier price — never stacked, the customer always gets the bigger win. */
export function effectiveUnitPrice(
  p: { price: number; onSale: boolean; salePercentage: number },
  qty: number,
  offers: QuantityOfferLike[],
): number {
  const offer = bestQuantityOffer(offers, qty);
  const offerPrice = offer ? p.price - Math.floor((p.price * offer.percentage) / 100) : p.price;
  return Math.min(salePrice(p), offerPrice);
}

/* ===== Vocabularies (validated at the API edge) ===== */

/** Narrow a free string against a const vocabulary array without casting. */
export function isOneOf<T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return (values as readonly string[]).includes(value);
}

// Product categories are no longer a vocabulary — they're rows in the
// Category table, grouped by Section. See prisma/schema.prisma.

export const ORDER_STATUSES = [
  "Processing",
  "Confirmed",
  "On the way",
  "Delivered",
  "Cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Narrow a status string read back from the database. Statuses are stored as
 * plain strings (not enums), so a row that predates a vocabulary change —or
 * was edited by hand — must fail loudly instead of corrupting stock math.
 */
export function parseOrderStatus(value: string): OrderStatus {
  if (!isOneOf(ORDER_STATUSES, value)) {
    throw new Error(`Unknown order status in database: "${value}"`);
  }
  return value;
}

/**
 * Pages that expose an editable hero. The list of record — the admin renders
 * one editor per key and PUT /admin/api/page-heroes/:pageKey 400s on anything
 * else, so a typo can't quietly create an orphan row nothing renders.
 * Keep in step with PAGE_HERO_KEYS in ../fronend/lib/admin.tsx.
 */
export const PAGE_HERO_KEYS = [
  "home",
  "shop",
  "services",
  "industrial",
  "contact",
] as const;
export type PageHeroKey = (typeof PAGE_HERO_KEYS)[number];

/** How a hero's background is rendered. */
export const PAGE_HERO_MODES = ["plain", "image", "posters"] as const;
export type PageHeroMode = (typeof PAGE_HERO_MODES)[number];

/**
 * Which products a customer may actually buy.
 *
 * `visible` alone is not the answer: campaign products are deliberately kept
 * off the storefront (`visible: false`) and sold only through a published
 * landing page reached from a Facebook ad. Those must still price and check
 * out, because /lp/:slug reuses the normal cart and order flow.
 *
 * Being orderable is NOT being listed — GET /api/products still filters on
 * `visible: true`, so an off-catalogue product stays undiscoverable; it just
 * stops 400ing when someone arrives with its id from a live campaign.
 * Unpublishing the last landing page carrying it closes that door again.
 *
 * Spread into the `where` of any query that decides whether a cart line is
 * purchasable, so the rule is stated exactly once.
 */
export function orderableProductWhere() {
  return {
    OR: [{ visible: true }, { landingPages: { some: { published: true } } }],
  };
}

export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Survey booked",
  "Quoted",
  "Won",
  "Lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/**
 * Industrial enquiries run a longer B2B pipeline than home-service leads, so
 * they get their own vocabulary rather than reusing LEAD_STATUSES: an EPC deal
 * is qualified and negotiated, and "Survey booked"/"Quoted" don't describe
 * those stages. Keep in step with INDUSTRIAL_LEAD_STATUSES in
 * ../fronend/lib/admin.tsx.
 */
export const INDUSTRIAL_LEAD_STATUSES = [
  "New",
  "Qualifying",
  "Site survey",
  "Proposal sent",
  "Negotiation",
  "Won",
  "Lost",
] as const;
export type IndustrialLeadStatus = (typeof INDUSTRIAL_LEAD_STATUSES)[number];

/** Client sector — drives routing to the right engineering team. */
export const INDUSTRIAL_SECTORS = [
  "Manufacturing",
  "Textile & RMG",
  "Pharmaceutical",
  "Food & Beverage",
  "Data centre",
  "Hospital & healthcare",
  "Commercial building",
  "Power & utility",
  "Other",
] as const;
export type IndustrialSector = (typeof INDUSTRIAL_SECTORS)[number];

/** What kind of engagement the enquiry is asking for. */
export const INDUSTRIAL_SCOPES = [
  "New installation",
  "Upgrade / retrofit",
  "Maintenance contract",
  "Consultancy only",
] as const;
export type IndustrialScope = (typeof INDUSTRIAL_SCOPES)[number];

/** How soon the client wants to start — the main triage signal for sales. */
export const INDUSTRIAL_TIMELINES = [
  "Immediate",
  "1-3 months",
  "3-6 months",
  "6+ months",
  "Planning / budgeting",
] as const;
export type IndustrialTimeline = (typeof INDUSTRIAL_TIMELINES)[number];

export const PO_STATUSES = ["Confirmed", "In transit", "Received", "Cancelled"] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

/** What an OrderEvent row records. Append-only — never reuse a kind's meaning. */
export const ORDER_EVENT_KINDS = [
  "placed",
  "status",
  "prepared-by",
  "invoice",
  "warranty",
  "note",
] as const;
export type OrderEventKind = (typeof ORDER_EVENT_KINDS)[number];

export const INVOICE_STATUSES = ["Draft", "Issued", "Paid", "Void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export function parseInvoiceStatus(value: string): InvoiceStatus {
  if (!isOneOf(INVOICE_STATUSES, value)) {
    throw new Error(`Unknown invoice status in database: "${value}"`);
  }
  return value;
}

export const WARRANTY_STATUSES = [
  "Active",
  "Expired",
  "Claimed",
  "Replaced",
  "Void",
] as const;
export type WarrantyStatus = (typeof WARRANTY_STATUSES)[number];

export function parseWarrantyStatus(value: string): WarrantyStatus {
  if (!isOneOf(WARRANTY_STATUSES, value)) {
    throw new Error(`Unknown warranty status in database: "${value}"`);
  }
  return value;
}

/**
 * Warranty expiry = start + N calendar months, clamped to the last day of the
 * target month. Plain date arithmetic overflows (31 Jan + 1 month → 2/3 Mar
 * depending on the year), which would silently hand the customer extra days.
 */
export function warrantyEndsAt(start: Date, months: number): Date {
  const end = new Date(start.getTime());
  const day = end.getDate();
  end.setDate(1);
  end.setMonth(end.getMonth() + months);
  const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  end.setDate(Math.min(day, lastDay));
  return end;
}
