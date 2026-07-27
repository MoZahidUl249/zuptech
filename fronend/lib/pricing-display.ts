/*
 * Presentation helpers for explaining a price.
 *
 * INVARIANT (cal-bk.md): the client never computes a charged amount. Every
 * money figure rendered must come from POST /api/pricing/quote. These helpers
 * produce *labels* ("Buy 3+ · 10% off", "Add 2 more for free delivery") and
 * read the discount that the server already applied — they never derive one.
 *
 * The quote returns only the net `unitPrice`; it doesn't say which discount
 * won (sale vs quantity offer never stack — the cheaper wins). So the reason
 * shown is inferred from the product's own fields, and is only ever displayed
 * when the server's own numbers confirm a discount was applied.
 */

import type { Product, QuantityOffer } from "@/lib/products";
import type { QuoteLine } from "@/lib/quote";

/** The best tier the given quantity qualifies for, if any. */
export function bestQuantityOffer(
  offers: QuantityOffer[] | undefined,
  qty: number,
): QuantityOffer | null {
  if (!offers?.length) return null;
  return offers
    .filter((o) => qty >= o.minQty)
    .reduce<QuantityOffer | null>(
      (best, o) => (!best || o.minQty > best.minQty ? o : best),
      null,
    );
}

/** The next tier up, for an "add N more" nudge. */
export function nextQuantityOffer(
  offers: QuantityOffer[] | undefined,
  qty: number,
): QuantityOffer | null {
  if (!offers?.length) return null;
  return offers
    .filter((o) => qty < o.minQty)
    .reduce<QuantityOffer | null>(
      (soonest, o) => (!soonest || o.minQty < soonest.minQty ? o : soonest),
      null,
    );
}

/**
 * Why this line is discounted, or null when it isn't.
 *
 * Gated on `line.unitPrice < product.price` — server truth — so this can never
 * advertise a discount the customer isn't actually getting.
 */
export function discountReason(product: Product, line: QuoteLine): string | null {
  if (line.unitPrice >= product.price) return null;

  const offer = bestQuantityOffer(product.quantityOffers, line.qty);
  const salePct = product.onSale ? (product.salePercentage ?? 0) : 0;

  // Sale and quantity offers never stack — whichever is cheaper wins. When an
  // offer tier applies and is at least as good, credit the tier.
  if (offer && offer.percentage >= salePct) {
    return `Buy ${offer.minQty}+ · ${offer.percentage}% off`;
  }
  if (salePct > 0) return `Sale · ${salePct}% off`;
  return "Discounted";
}

/** Savings versus the regular price, from the server's own line total. */
export function lineSavings(product: Product, line: QuoteLine): number {
  return Math.max(0, product.price * line.qty - line.lineTotal);
}

export interface FreeDeliveryState {
  /** Delivery is free for this line. */
  free: boolean;
  /** Units still needed to qualify, when a threshold exists and isn't met. */
  unitsAway: number | null;
}

/**
 * Free-delivery status. Prefers server truth (`line.deliveryFee === 0`) and
 * falls back to the product's threshold while the zone is still unknown.
 */
export function freeDeliveryState(product: Product, line: QuoteLine): FreeDeliveryState {
  const threshold = product.freeDeliveryMinQty ?? 0;

  if (line.deliveryFee === 0) return { free: true, unitsAway: null };
  if (threshold <= 0) return { free: false, unitsAway: null };
  if (line.qty >= threshold) return { free: true, unitsAway: null };
  return { free: false, unitsAway: threshold - line.qty };
}

/** Total saved across the cart, from server line totals. */
export function cartSavings(
  lines: QuoteLine[],
  productById: (id: string) => Product | undefined,
): number {
  return lines.reduce((sum, line) => {
    const p = productById(line.productId);
    return p ? sum + lineSavings(p, line) : sum;
  }, 0);
}

/** "Buy 3+ save 10% · Buy 5+ save 15%" — available tiers, for product pages
 *  where no quantity is chosen yet. */
export function offerTiersLabel(offers: QuantityOffer[] | undefined): string | null {
  if (!offers?.length) return null;
  return [...offers]
    .sort((a, b) => a.minQty - b.minQty)
    .map((o) => `Buy ${o.minQty}+ save ${o.percentage}%`)
    .join(" · ");
}
