import { createHash, timingSafeEqual } from "node:crypto";
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
 * Category logos are stored as SVG *markup*, not as uploaded files — the media
 * pipeline only accepts raster formats and rasterizes what it stores, which
 * would defeat the point of a vector logo.
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

/**
 * Compare a caller-supplied secret against the stored one in constant time.
 *
 * `a !== b` on a secret leaks its contents: string comparison returns as soon
 * as two bytes differ, so the time it takes to reject an attempt tells the
 * caller how many leading characters were right, and a secret can be recovered
 * a character at a time rather than guessed whole. The payment webhook was
 * comparing its shared secret that way.
 *
 * Both sides are hashed first because `timingSafeEqual` throws on a length
 * mismatch — which would itself leak the secret's length. Hashing makes both
 * inputs 32 bytes whatever was sent.
 */
export function secretsMatch(supplied: string | undefined, stored: string | undefined): boolean {
  if (!supplied || !stored) return false;
  const a = createHash("sha256").update(supplied).digest();
  const b = createHash("sha256").update(stored).digest();
  return timingSafeEqual(a, b);
}

/** True when a client-submitted secret is the mask we sent (i.e. unchanged). */
export function isMaskedSecret(value: string): boolean {
  return value.startsWith("••••");
}

/* ===== List limits ===== */

/**
 * Most rows an unpaginated list endpoint will return.
 *
 * These lists had no bound at all: `GET /admin/api/orders` loaded every order
 * ever placed, each with its items, invoice and warranty count, on every page
 * load of the admin. That is fine at six orders and quietly ruinous at sixty
 * thousand, and the failure mode is a screen that gets slower every month
 * until someone notices.
 *
 * The cap is deliberately generous and always paired with a newest-first sort,
 * so what falls off the end is the oldest — the rows nobody is working from.
 * When a real shop outgrows it the answer is proper pagination in the admin
 * UI, not a bigger number here.
 */
export const LIST_CAP = 500;

/**
 * Rows a paged endpoint returns when the caller doesn't say.
 *
 * A screenful, not a catalogue. The storefront's shop grid is 3–4 across, so
 * 48 fills several scrolls without asking the server to render 1.4 MB of HTML
 * per request — which is what the unpaged version cost, and what made one page
 * the throughput ceiling for the entire site.
 */
export const DEFAULT_PAGE_SIZE = 48;

/* ===== Money =====
 *
 * Every discount here is a flat BDT amount, not a percentage. That is a
 * deliberate simplification: percentages meant the same discount got rounded
 * three different ways (the server floored it, the admin preview rounded it,
 * the product card rounded again off a different base), so a ৳999 product at
 * 33% off displayed ৳669 in the admin and charged ৳670 at the till. Subtraction
 * has nothing to round.
 */

/** What the customer pays: the stored sale price while it is on sale and
 *  actually below the list price, otherwise the list price. A sale price of 0
 *  means "not set" rather than "free". */
export function sellingPrice(p: { price: number; onSale: boolean; salePrice: number }): number {
  return p.onSale && p.salePrice > 0 && p.salePrice < p.price ? p.salePrice : p.price;
}

/**
 * Resolve an admin-typed discount into the taka the customer pays.
 *
 * THE ONLY PLACE A PERCENTAGE BECOMES MONEY. Call it on write, store the
 * result in `salePrice`, and let every reader work from that — never from the
 * percentage. The paragraph above records what happens when several places
 * each do this sum with their own rounding: a ৳999 product at 33% off showing
 * ৳669 and charging ৳670. One call site, one rounding, one stored answer.
 *
 * Because the result depends on `price`, changing a product's price without
 * calling this again leaves the advertised percentage and the charged amount
 * disagreeing. The admin write path recomputes on either field changing.
 */
export function salePriceFrom(price: number, salePct: number): number {
  const pct = Math.min(100, Math.max(0, Math.round(salePct)));
  if (pct === 0) return 0;
  return Math.round((price * (100 - pct)) / 100);
}

/** The labels the storefront may show. "" renders no tag at all. */
export const STOCK_TAGS = ["Out of stock", "Incoming", "Sold out"] as const;
export type StockTag = (typeof STOCK_TAGS)[number] | "";

/**
 * The status tag on a product card.
 *
 * Manual override wins outright — that is the point of the column, and it is
 * how "Sold out" is ever shown: derived, it would be indistinguishable from
 * "Out of stock", so automatic resolution never produces it. It exists to say
 * a line is finished for good rather than merely empty today.
 *
 * `hasIncoming` is a yes/no about an in-transit purchase order, resolved by
 * the caller — `productInclude` fetches at most one id for exactly this, so a
 * product listing does not drag a purchase-order history along with it.
 */
export function stockTagFor(
  p: StockLike & { stockTag: string },
  hasIncoming: boolean,
): StockTag {
  if (p.stockTag) return p.stockTag as StockTag;
  if (availableStock(p) > 0) return "";
  return hasIncoming ? "Incoming" : "Out of stock";
}

/**
 * A "buy N+, take ৳X off" tier. Both offer kinds — QuantityOffer (off the unit
 * price) and FreeDeliveryOffer (off the zone delivery fee) — share this shape
 * and this resolution rule, so they share the search below.
 */
interface OfferTierLike {
  minQty: number;
  amount: number;
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

/** BDT off the delivery fee at this qty: the best tier's amount, else 0. */
export function deliveryDiscountAmount(offers: OfferTierLike[], qty: number): number {
  return bestOfferTier(offers, qty)?.amount ?? 0;
}

/** The zone delivery fee a line actually pays, after its best tier. Clamped at
 *  zero, which is also what makes "free delivery" expressible: an amount at or
 *  above the fee ships the line free in whichever zone it resolves to. */
export function discountedDeliveryFee(
  zoneFee: number,
  offers: OfferTierLike[],
  qty: number,
): number {
  return Math.max(0, zoneFee - deliveryDiscountAmount(offers, qty));
}

/** Effective unit price: the cheaper of the sale price and the best qty-tier
 *  price — never stacked, the customer always gets the bigger win. Floored at
 *  zero so an over-generous tier can't produce a negative line. */
export function effectiveUnitPrice(
  p: { price: number; onSale: boolean; salePrice: number },
  qty: number,
  offers: OfferTierLike[],
): number {
  const offer = bestOfferTier(offers, qty);
  const offerPrice = offer ? Math.max(0, p.price - offer.amount) : p.price;
  return Math.min(sellingPrice(p), offerPrice);
}

/**
 * A "buy N+, pay ৳P each" row on ONE campaign.
 *
 * Deliberately NOT shaped like `OfferTierLike`. `unitPrice` is an absolute
 * price and `amount` is a discount; making a campaign tier structurally
 * assignable to a discount ladder would let one be passed where the other is
 * expected and priced as taka-off, which is the exact confusion this table
 * exists to end.
 */
export interface CampaignTierLike {
  minQty: number;
  unitPrice: number;
}

/** Best (highest-threshold) campaign tier the given qty qualifies for, or null. */
export function bestCampaignTier<T extends CampaignTierLike>(tiers: T[], qty: number): T | null {
  let best: T | null = null;
  for (const tier of tiers) {
    if (qty >= tier.minQty && (!best || tier.minQty > best.minQty)) best = tier;
  }
  return best;
}

/**
 * Effective unit price with a campaign's own ladder in play.
 *
 * This is the one function the advertised price and the charged price both go
 * through — `toPublicLandingPage()` builds the bundle rows with it and
 * `priceCart()` prices the order with it — which is what keeps an ad from
 * quoting a total the cart will refuse.
 *
 * A campaign price is absolute, so unlike a QuantityOffer it cannot be
 * silently eaten by a deeper sale. It is still FLOORED BY THE SHOP PRICE:
 * a tier at or above what the shop charges is inert, so a mistyped number — or
 * a sale that deepens after the campaign was written — can never charge ad
 * traffic more than walking in the front door would. The customer keeps
 * getting the bigger win, which is the rule everywhere else here.
 *
 * With no tiers this IS `effectiveUnitPrice`: the fallback to catalogue
 * pricing is the identity of the function, not a branch a caller has to
 * remember to write.
 */
export function campaignUnitPrice(
  p: { price: number; onSale: boolean; salePrice: number },
  qty: number,
  offers: OfferTierLike[],
  campaignTiers: CampaignTierLike[],
): number {
  const base = effectiveUnitPrice(p, qty, offers);
  const tier = bestCampaignTier(campaignTiers, qty);
  return tier ? Math.max(0, Math.min(base, tier.unitPrice)) : base;
}

/** Raster formats a browser paints in an <img> and cannot play in a <video>. */
const IMAGE_URL_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "svg"];

/**
 * Whether a URL somebody PASTED should be stored as a picture or a clip.
 *
 * Uploads do not come through here — `classifyAndValidate` sniffs their magic
 * bytes, which is stronger than anything a path can tell you. This is for the
 * campaign gallery's "paste a link" box, where there are no bytes to sniff
 * until a visitor's browser fetches it.
 *
 * It used to hard-code "video", on the reasoning that a photo would have been
 * uploaded. Pasting a photo link is an obvious thing to do, and doing it put
 * the picture inside a <video> — a black rectangle with MediaError.code 4
 * behind it, no fallback, and nothing to tell the person who pasted it.
 *
 * Extension-only, and it only ever answers "image" when it is sure: a URL with
 * no extension is a clip, because that is the YouTube case and YouTube links
 * are the reason the box exists. `looksLikeImageUrl` in the frontend's
 * lib/images.ts is the render-side twin, so an already-stored row with the
 * wrong kind still draws correctly.
 */
export function classifyMediaUrl(url: string): "image" | "video" {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return "video";
  }
  const ext = pathname.split(".").pop()?.toLowerCase();
  return ext !== undefined && IMAGE_URL_EXTENSIONS.includes(ext) ? "image" : "video";
}

/**
 * The `minQty` values appearing more than once in a ladder.
 *
 * Stated once because three places enforce it: the product's two ladders, the
 * campaign's, and the admin editors that mirror the rule client-side. A
 * duplicate is a 400 rather than a Prisma unique-constraint 500.
 */
export function duplicateMinQtys(tiers: { minQty: number }[]): number[] {
  const seen = new Set<number>();
  const dupes = new Set<number>();
  for (const { minQty } of tiers) {
    if (seen.has(minQty)) dupes.add(minQty);
    seen.add(minQty);
  }
  return [...dupes];
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
/**
 * The pages a hero slide can appear on.
 *
 * /services and /industrial used to render the homepage carousel verbatim, so
 * every page showed the same art. A slide now names the pages it belongs to.
 */
export const HERO_PAGES = ["home", "services", "industrial"] as const;
export type HeroPage = (typeof HERO_PAGES)[number];

export const HERO_MEDIA_TYPES = ["image", "video"] as const;
export type HeroMediaType = (typeof HERO_MEDIA_TYPES)[number];

/** Which half of a service card its photo takes on the storefront. The card is
 *  a 50/50 split, so this is the whole of its layout — stored per row because
 *  alternating the side down the column is an editorial choice, not something
 *  the frontend should infer from a row's position in the list. */
export const SERVICE_IMAGE_SIDES = ["left", "right"] as const;
export type ServiceImageSide = (typeof SERVICE_IMAGE_SIDES)[number];

/** The marker in front of each feature on a service card: a tick, a dot, or
 *  nothing at all. Stored per card so a list of capabilities can read as a
 *  checklist while a list of specs reads as plain lines. */
export const SERVICE_BULLET_STYLES = ["tick", "dot", "plain"] as const;
export type ServiceBulletStyle = (typeof SERVICE_BULLET_STYLES)[number];

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
