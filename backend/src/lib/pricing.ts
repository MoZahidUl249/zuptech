import type { FreeDeliveryOffer, Product, QuantityOffer } from "../generated/client";
import { badRequest } from "./http";
import { prisma } from "./db";
import {
  availableStock,
  campaignUnitPrice,
  discountedDeliveryFee,
  orderableProductWhere,
  type CampaignTierLike,
} from "./rules";

/**
 * Server-side pricing engine (cal-bk.md §2) — the only place cart money is
 * computed. Clients send ids + quantities; unit prices are re-read at call
 * time from the catalog, and from the named campaign's own ladder when the
 * request carries a published campaign slug. Never from the client, never
 * from a cached quote — so price tampering and stale-price replay remain
 * structurally impossible.
 *
 * A campaign widens the INPUTS the server reads; it does not soften the rule
 * about whose numbers are trusted. `resolveCampaignPricing()` below turns a
 * slug into stored rows, and nothing a client sends reaches the arithmetic.
 */

/**
 * What a campaign is allowed to change about a price, resolved from its slug
 * exactly once per request.
 *
 * `productId` is the fence: a campaign prices its OWN product and nothing else
 * in the cart.
 */
export interface CampaignPricing {
  id: string;
  productId: string;
  tiers: CampaignTierLike[];
}

/**
 * Resolve a campaign slug to what it may price, or null.
 *
 * Checked against the PUBLISHED set, and null for an unknown, stale or
 * unpublished slug — the same silent rule the order route already applied to
 * attribution, now covering price too, because they are one decision and must
 * never be able to disagree. A guessed slug quotes and charges catalogue
 * prices rather than failing: a broken campaign link must not cost a sale.
 *
 * Deliberately a separate call rather than a lookup inside `priceCart()`, so
 * that function still performs exactly one query and stays the single place
 * money is computed rather than becoming a router too.
 */
export async function resolveCampaignPricing(
  slug: string | undefined,
): Promise<CampaignPricing | null> {
  if (!slug) return null;
  const lp = await prisma.landingPage.findUnique({
    where: { slug },
    select: {
      id: true,
      published: true,
      productId: true,
      tiers: { select: { minQty: true, unitPrice: true }, orderBy: { minQty: "asc" } },
    },
  });
  if (!lp?.published) return null;
  return { id: lp.id, productId: lp.productId, tiers: lp.tiers };
}

export interface PricedLine {
  product: Product & { quantityOffers: QuantityOffer[]; freeDeliveryOffers: FreeDeliveryOffer[] };
  qty: number;
  unitPrice: number;
  lineTotal: number;
  deliveryFee: number | null; // per unit, zone-specific, after any free-delivery tier; null until insideDhaka is known
  installationFee: number | null; // per unit, zone-specific; null until insideDhaka is known
}

export interface PricedCart {
  lines: PricedLine[];
  subtotal: number;
  insideDhaka: boolean | null; // null until the delivery zone is known
  deliveryFee: number | null; // Σ line.deliveryFee × qty; null until insideDhaka is known
  installationFee: number | null; // Σ line.installationFee × qty; null until insideDhaka is known
  total: number | null; // subtotal + deliveryFee + installationFee
}

/** Per-product quantity ceiling, mirroring the per-line cap in cartItemsDto. */
const MAX_QTY_PER_PRODUCT = 99;

/**
 * Collapse repeated lines for the same product into one.
 *
 * The wire format lets a cart carry the same productId on several lines, and
 * treating those as independent breaks two things at once: the stock check
 * passes per line rather than per product (three lines of 5 clear a stock of 5,
 * then reserve 15), and each line resolves its quantity-offer tier on its own
 * partial qty instead of the total the customer actually bought. Summing first
 * is what makes both correct, so every caller gets one line per product.
 */
function mergeItems(items: { productId: string; qty: number }[]) {
  const merged = new Map<string, number>();
  for (const { productId, qty } of items) {
    merged.set(productId, (merged.get(productId) ?? 0) + qty);
  }
  return [...merged].map(([productId, qty]) => ({ productId, qty }));
}

/**
 * Price a validated cart. Products that are neither on the storefront nor on
 * a published landing page are indistinguishable from unknown ones (both
 * 400) — see orderableProductWhere(). `enforceStock` is on for real orders,
 * off for display quotes so a cart can still show prices while stock shifts.
 */
export async function priceCart(
  rawItems: { productId: string; qty: number }[],
  insideDhaka: boolean | undefined,
  {
    enforceStock = false,
    campaign = null,
  }: { enforceStock?: boolean; campaign?: CampaignPricing | null } = {},
): Promise<PricedCart> {
  const items = mergeItems(rawItems);

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, ...orderableProductWhere() },
    include: { quantityOffers: true, freeDeliveryOffers: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines = items.map(({ productId, qty }) => {
    const product = byId.get(productId);
    if (!product) throw badRequest(`Unknown product: ${productId}`);
    // Per-line quantity is capped by cartItemsDto; re-check the merged total so
    // the cap can't be lifted by splitting one product across several lines.
    if (qty > MAX_QTY_PER_PRODUCT) {
      throw badRequest(`At most ${MAX_QTY_PER_PRODUCT} of "${product.name}" per order`);
    }
    if (enforceStock) {
      /*
       * A pinned "Sold out" retires the line regardless of what is on the
       * shelf — units may remain that are deliberately not for sale, so this
       * cannot be expressed by zeroing stock, and `availableStock` below would
       * happily let them through.
       *
       * It has to be enforced here rather than left to the storefront: the
       * cart lives in the browser, so anyone holding the product from before
       * the pin still reaches checkout with it. Under `enforceStock` only,
       * which keeps display quotes working — a stale cart can still show its
       * prices, it just cannot become an order.
       */
      if (product.stockTag === "Sold out") {
        throw badRequest(`"${product.name}" is sold out`);
      }
      const available = availableStock(product);
      if (qty > available) throw badRequest(`Only ${available} of "${product.name}" in stock`);
    }
    /* The campaign prices its own product only; every other line in the cart
       is catalogue-priced, because a mixed cart is a shopper rather than an
       attacker and refusing it would invent a new way to fail a checkout. */
    const unitPrice = campaignUnitPrice(
      product,
      qty,
      product.quantityOffers,
      campaign && campaign.productId === product.id ? campaign.tiers : [],
    );
    return {
      product,
      qty,
      unitPrice,
      lineTotal: unitPrice * qty,
      deliveryFee:
        insideDhaka === undefined
          ? null
          : discountedDeliveryFee(
              insideDhaka ? product.deliveryFeeInsideDhaka : product.deliveryFeeOutsideDhaka,
              product.freeDeliveryOffers,
              qty,
            ),
      installationFee:
        insideDhaka === undefined
          ? null
          : insideDhaka
            ? product.installationFeeInsideDhaka
            : product.installationFeeOutsideDhaka,
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  if (insideDhaka === undefined) {
    return {
      lines,
      subtotal,
      insideDhaka: null,
      deliveryFee: null,
      installationFee: null,
      total: null,
    };
  }

  const deliveryFee = lines.reduce((sum, line) => sum + (line.deliveryFee ?? 0) * line.qty, 0);
  const installationFee = lines.reduce((sum, line) => sum + (line.installationFee ?? 0) * line.qty, 0);

  return {
    lines,
    subtotal,
    insideDhaka,
    deliveryFee,
    installationFee,
    total: subtotal + deliveryFee + installationFee,
  };
}

/** Human-readable order summary, e.g. "1000VA IPS + Battery Combo ×1". */
export function orderSummary(lines: PricedLine[]): string {
  return lines.map((line) => `${line.product.name} ×${line.qty}`).join(", ");
}
