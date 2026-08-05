import * as cheerio from "cheerio";

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

/* ===== Internal sign-in identifiers =====
 *
 * Better Auth requires an email per account, but neither audience signs in
 * with one: customers use a phone, staff a username. Both are mapped to a
 * deterministic address under a .local domain that can never receive mail.
 * The real, deliverable address lives on `Customer.email` / `Staff.email` and
 * is only ever used as a destination — never as an identity. `parseInternalEmail`
 * is the bridge: it turns a synthetic address back into the lookup key needed
 * to find where a message should actually go (see lib/auth.ts).
 */

const CUSTOMER_EMAIL_DOMAIN = "customers.zuptech.local";
const STAFF_EMAIL_DOMAIN = "staff.zuptech.local";

/** Synthetic address Better Auth stores for a phone-only customer account. */
export function customerEmail(phone: string): string {
  return `${phone}@${CUSTOMER_EMAIL_DOMAIN}`;
}

/** Synthetic address Better Auth stores for a staff account. */
export function staffEmail(username: string): string {
  return `${username}@${STAFF_EMAIL_DOMAIN}`;
}

export interface InternalEmail {
  audience: "customer" | "staff";
  /** Customer phone, or staff username — whichever identifies the account. */
  key: string;
}

/** Reverse of `customerEmail`/`staffEmail`; null for anything else (including
 *  a real customer address, which is never a sign-in identity). */
export function parseInternalEmail(email: string): InternalEmail | null {
  const at = email.lastIndexOf("@");
  if (at <= 0) return null;
  const key = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (domain === CUSTOMER_EMAIL_DOMAIN) return { audience: "customer", key };
  if (domain === STAFF_EMAIL_DOMAIN) return { audience: "staff", key };
  return null;
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
 *
 * This is an ALLOWLIST over a parsed tree, and it has to stay one. The
 * previous version pattern-matched the raw string for dangerous constructs,
 * which is unwinnable: `/\son[a-z]+=/` looks for whitespace before an event
 * handler, but `<rect/onmouseover=…>` and `<rect id="a"onmouseover=…>` are
 * both valid to an HTML parser and neither has any; `javascript:` written as
 * `&#106;avascript:` is decoded by the browser after the check has passed.
 * A blocklist has to enumerate every such trick, an allowlist doesn't.
 *
 * Two properties do the work:
 *  - the markup is parsed with parse5 in HTML mode — the same parsing the
 *    browser applies to innerHTML — so what is validated is what will render,
 *    not a string that merely looks similar;
 *  - what's stored is re-serialized FROM that parse, so no unparsed remainder
 *    survives to be interpreted differently later.
 */
export const MAX_SVG_LOGO_BYTES = 32 * 1024;

/** Inert drawing elements. Nothing that scripts, loads, animates or embeds. */
const SVG_ALLOWED_ELEMENTS = new Set([
  "svg", "g", "title", "desc", "defs",
  "path", "circle", "ellipse", "rect", "line", "polyline", "polygon",
  "lineargradient", "radialgradient", "stop", "clippath", "mask", "use",
]);

/** Geometry, paint and grouping only — no `style` (CSS can reposition the
 *  element over the page), no url-bearing attributes beyond the ones below. */
const SVG_ALLOWED_ATTRS = new Set([
  // structure / a11y
  "xmlns", "xmlns:xlink", "version", "viewbox", "preserveaspectratio",
  "id", "class", "role", "aria-hidden", "aria-label", "focusable",
  // geometry
  "d", "points", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
  "width", "height", "transform", "gradienttransform", "gradientunits",
  "spreadmethod", "offset", "fx", "fy", "clip-path", "clip-rule", "mask",
  // paint
  "fill", "fill-rule", "fill-opacity", "opacity", "color",
  "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "stroke-opacity",
  "stop-color", "stop-opacity",
  // <use> only — restricted to same-document refs by the value check below
  "href", "xlink:href",
]);

/** Attribute values may not reach off-document or carry a script scheme.
 *  Entities are already decoded by the parser at this point, so this sees
 *  what the browser would see, not the source text. */
const SVG_UNSAFE_VALUE = /(?:javascript|data|vbscript)\s*:|\/\//i;

/**
 * Namespace declarations are the one place a `//` URL is both expected and
 * inert — it names a namespace, nothing fetches it. Pinned to the two real
 * values rather than exempted from the check, so the hole is exactly this big.
 */
const SVG_NAMESPACE_ATTRS: Record<string, string> = {
  xmlns: "http://www.w3.org/2000/svg",
  "xmlns:xlink": "http://www.w3.org/1999/xlink",
};

/**
 * Validate SVG logo markup, returning the value to store. Throws a plain
 * Error with a human-readable reason; routes turn that into a 400.
 */
export function sanitizeSvgLogo(raw: string): string {
  // Strip the noise editors add above the root: XML prolog and comments.
  const source = raw
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();

  if (!source) return "";
  if (Buffer.byteLength(source, "utf8") > MAX_SVG_LOGO_BYTES) {
    throw new Error(`Logo must be under ${MAX_SVG_LOGO_BYTES / 1024}KB`);
  }
  if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(source)) {
    throw new Error("DOCTYPE/ENTITY declarations are not allowed");
  }

  // Fragment parse, HTML mode: `<svg>` puts parse5 into foreign-content mode,
  // exactly as it would inside innerHTML on the storefront.
  const $ = cheerio.load(source, undefined, false);

  const roots = $.root().children().toArray();
  if (roots.length !== 1 || roots[0]?.tagName?.toLowerCase() !== "svg") {
    throw new Error("Logo must be a single <svg> element");
  }

  $("*").each((_, node) => {
    // Narrows AnyNode to an element. "script"/"style" are their own node types
    // in domhandler and must be listed, or they'd skip the allowlist below —
    // which is precisely backwards.
    if (node.type !== "tag" && node.type !== "script" && node.type !== "style") return;

    const tag = node.tagName?.toLowerCase() ?? "";
    if (!SVG_ALLOWED_ELEMENTS.has(tag)) {
      throw new Error(`<${tag}> is not allowed — logos may only contain drawing elements`);
    }
    for (const [name, value] of Object.entries(node.attribs ?? {})) {
      const attr = name.toLowerCase();
      if (attr.startsWith("on")) {
        throw new Error("event handler attributes (onclick, onload, …) are not allowed");
      }
      if (!SVG_ALLOWED_ATTRS.has(attr)) {
        throw new Error(`the "${name}" attribute is not allowed on <${tag}>`);
      }
      const namespace = SVG_NAMESPACE_ATTRS[attr];
      if (namespace !== undefined) {
        if (value !== namespace) throw new Error(`"${name}" must be "${namespace}"`);
        continue;
      }
      if (SVG_UNSAFE_VALUE.test(value)) {
        throw new Error(
          `"${name}" may not use a script/data URL or an external reference — inline the artwork`,
        );
      }
    }
  });

  // Store the re-serialized tree, not the input string.
  return $.root().html() ?? "";
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

/**
 * A "buy N+, take X% off" tier. Both offer kinds — QuantityOffer (off the unit
 * price) and FreeDeliveryOffer (off the zone delivery fee) — share this shape
 * and this resolution rule, so they share the search below.
 */
interface OfferTierLike {
  minQty: number;
  percentage: number;
}

/** Best (highest-threshold) tier the given qty qualifies for, or null. */
export function bestOfferTier<T extends OfferTierLike>(offers: T[], qty: number): T | null {
  let best: T | null = null;
  for (const offer of offers) {
    if (qty >= offer.minQty && (!best || offer.minQty > best.minQty)) best = offer;
  }
  return best;
}

/** Best quantity-discount tier for this qty, or null. */
export const bestQuantityOffer = bestOfferTier;

/** % off the delivery fee at this qty: the best tier's percentage, else 0.
 *  100 means the line ships free. */
export function deliveryDiscountPercent(offers: OfferTierLike[], qty: number): number {
  return bestOfferTier(offers, qty)?.percentage ?? 0;
}

/** The zone delivery fee a line actually pays, after its best tier. Rounded
 *  down like every other discount here, so the customer keeps the remainder. */
export function discountedDeliveryFee(
  zoneFee: number,
  offers: OfferTierLike[],
  qty: number,
): number {
  const percent = deliveryDiscountPercent(offers, qty);
  return percent <= 0 ? zoneFee : zoneFee - Math.floor((zoneFee * percent) / 100);
}

/** Effective unit price: the cheaper of the flat sale price and the best
 *  qty-tier price — never stacked, the customer always gets the bigger win. */
export function effectiveUnitPrice(
  p: { price: number; onSale: boolean; salePercentage: number },
  qty: number,
  offers: OfferTierLike[],
): number {
  const offer = bestOfferTier(offers, qty);
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

/**
 * Narrow a column to its vocabulary for a response, falling back when the row
 * holds something the vocabulary no longer covers (a legacy value, or a
 * hand-edited row).
 *
 * The `parse*` helpers below throw instead, which is right on a single-record
 * write path where corruption should stop the operation. These values are
 * serialized into list responses, where throwing would take out the whole
 * admin screen over one bad row — degrading to a sane default is the better
 * failure. Either way the response type is now honest about the vocabulary,
 * which it wasn't while these were all typed `string`.
 */
export function coerceTo<T extends readonly string[]>(
  values: T,
  value: string,
  fallback: T[number],
): T[number] {
  return isOneOf(values, value) ? value : fallback;
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

/** How a payment method is settled, and which gateway credentials it uses.
 *  These were literals inlined in payments.dto.ts; they live here now so the
 *  request DTO and the response contract are built from one vocabulary, the
 *  same as every other list in this file. */
export const PAYMENT_KINDS = ["Mobile wallet", "Card gateway", "Offline"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_ENVIRONMENTS = ["Live", "Test"] as const;
export type PaymentEnvironment = (typeof PAYMENT_ENVIRONMENTS)[number];

/** What a hero slide's art actually is. A video slide plays inline, muted and
 *  looping; an image slide is a still. The two need different markup, so the
 *  kind is stored rather than guessed from the URL. */
export const HERO_MEDIA_TYPES = ["image", "video"] as const;
export type HeroMediaType = (typeof HERO_MEDIA_TYPES)[number];

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
