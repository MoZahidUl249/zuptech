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

import type { FreeDeliveryOffer, Product, QuantityOffer } from "@/lib/products";
import type { QuoteLine } from "@/lib/quote";

/** Both offer kinds are `{minQty, percentage}` ladders resolved the same way
 *  (highest satisfied tier wins, never stacked), so they share these two
 *  searches — mirroring `bestOfferTier` in the backend's lib/rules.ts. */
interface OfferTier {
  minQty: number;
  percentage: number;
}

/** The best tier the given quantity qualifies for, if any. */
export function bestOfferTier<T extends OfferTier>(
  offers: T[] | undefined,
  qty: number,
): T | null {
  if (!offers?.length) return null;
  return offers
    .filter((o) => qty >= o.minQty)
    .reduce<T | null>((best, o) => (!best || o.minQty > best.minQty ? o : best), null);
}

/** The next tier up, for an "add N more" nudge. */
export function nextOfferTier<T extends OfferTier>(
  offers: T[] | undefined,
  qty: number,
): T | null {
  if (!offers?.length) return null;
  return offers
    .filter((o) => qty < o.minQty)
    .reduce<T | null>((soonest, o) => (!soonest || o.minQty < soonest.minQty ? o : soonest), null);
}

export const bestQuantityOffer = bestOfferTier<QuantityOffer>;
export const nextQuantityOffer = nextOfferTier<QuantityOffer>;
export const bestDeliveryOffer = bestOfferTier<FreeDeliveryOffer>;
export const nextDeliveryOffer = nextOfferTier<FreeDeliveryOffer>;

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
  /** % off the delivery fee the current qty has earned (0–100). */
  discountPercent: number;
  /** Units still needed to reach the next tier, when there is one. */
  unitsAway: number | null;
  /** What that next tier is worth, so the nudge can name the reward. */
  nextPercent: number | null;
}

/**
 * Free-delivery status across the ladder. Prefers server truth
 * (`line.deliveryFee === 0`) for the "free" claim and reads the product's own
 * tiers to explain the partial discounts and what the next one is worth.
 */
export function freeDeliveryState(product: Product, line: QuoteLine): FreeDeliveryState {
  const tiers = product.freeDeliveryOffers ?? [];
  const earned = bestDeliveryOffer(tiers, line.qty);
  const next = nextDeliveryOffer(tiers, line.qty);

  // The server zeroed the fee, so delivery is free regardless of what the
  // tiers say — nothing is left to unlock.
  if (line.deliveryFee === 0) {
    return { free: true, discountPercent: 100, unitsAway: null, nextPercent: null };
  }

  return {
    free: false,
    discountPercent: earned?.percentage ?? 0,
    unitsAway: next ? next.minQty - line.qty : null,
    nextPercent: next?.percentage ?? null,
  };
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

/** "Buy 2+ half delivery · Buy 5+ free delivery" — the delivery ladder. */
export function deliveryTierLabel(offers: FreeDeliveryOffer[] | undefined): string | null {
  if (!offers?.length) return null;
  return [...offers]
    .sort((a, b) => a.minQty - b.minQty)
    .map((o) => `Buy ${o.minQty}+ ${deliveryRewardLabel(o.percentage)}`)
    .join(" · ");
}

/** 100 reads as "free delivery", 50 as "half-price delivery", the rest as a
 *  plain percentage — a shopper parses those far faster than "100% off". */
function deliveryRewardLabel(percentage: number): string {
  if (percentage >= 100) return "free delivery";
  if (percentage === 50) return "half-price delivery";
  return `${percentage}% off delivery`;
}

/* ===== The offer ladder =====
 *
 * One normalized list of every promotion a product carries, in the order a
 * customer unlocks them. This is the model behind <OfferLadder/>; keeping it
 * here means the card, the product page, the cart line and the landing page
 * all describe the same offers in the same words.
 *
 * Still labels only — no rung carries a charged amount. `state` is derived
 * from the quantity in hand, which is a client-side fact (what's in the
 * stepper / the cart line), never a price.
 */

export interface OfferRung {
  kind: "sale" | "qty" | "delivery";
  /** Quantity that unlocks this rung; null for the flat sale, which always applies. */
  minQty: number | null;
  /** What the rung is worth, 1–100. For delivery, 100 means it ships free. */
  percentage: number;
  /** Short headline, e.g. "Buy 3+" or "Sale". */
  label: string;
  /** What it's worth, e.g. "Save 5% per unit" or "Free delivery". */
  detail: string;
  state: "active" | "locked";
  /** Units still needed, when locked and a quantity is known. */
  unitsAway: number | null;
}

/**
 * Every offer on a product, strongest-first within each kind.
 *
 * `qty` is optional: omit it on surfaces where no quantity has been chosen
 * (a product card, a landing page hero) and every rung comes back `locked`,
 * purely informational. Pass it and the rungs the customer has earned light up.
 */
export function offerLadder(product: Product, qty?: number): OfferRung[] {
  const rungs: OfferRung[] = [];
  const salePct = product.onSale ? (product.salePercentage ?? 0) : 0;

  if (salePct > 0) {
    rungs.push({
      kind: "sale",
      minQty: null,
      percentage: salePct,
      label: `${salePct}% sale`,
      detail: "On every unit, no minimum",
      state: "active", // a flat sale needs no quantity to qualify
      unitsAway: null,
    });
  }

  for (const offer of [...(product.quantityOffers ?? [])].sort((a, b) => a.minQty - b.minQty)) {
    const earned = qty !== undefined && qty >= offer.minQty;
    rungs.push({
      kind: "qty",
      minQty: offer.minQty,
      percentage: offer.percentage,
      label: `Buy ${offer.minQty}+`,
      detail: `Save ${offer.percentage}% per unit`,
      state: earned ? "active" : "locked",
      unitsAway: qty !== undefined && !earned ? offer.minQty - qty : null,
    });
  }

  for (const offer of [...(product.freeDeliveryOffers ?? [])].sort((a, b) => a.minQty - b.minQty)) {
    const earned = qty !== undefined && qty >= offer.minQty;
    rungs.push({
      kind: "delivery",
      minQty: offer.minQty,
      percentage: offer.percentage,
      label: `Buy ${offer.minQty}+`,
      detail: deliveryRewardLabel(offer.percentage).replace(/^./, (c) => c.toUpperCase()),
      state: earned ? "active" : "locked",
      unitsAway: qty !== undefined && !earned ? offer.minQty - qty : null,
    });
  }

  return rungs;
}

/** The nearest rung the customer hasn't earned yet — the one worth nudging
 *  toward. Null when everything is unlocked or no quantity is known. */
export function nextRung(rungs: OfferRung[]): OfferRung | null {
  return rungs
    .filter((r) => r.state === "locked" && r.unitsAway !== null)
    .reduce<OfferRung | null>(
      (soonest, r) => (!soonest || r.unitsAway! < soonest.unitsAway! ? r : soonest),
      null,
    );
}
