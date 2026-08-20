/*
 * Presentation helpers for explaining a price.
 *
 * INVARIANT (cal-bk.md): the client never computes a charged amount. Every
 * money figure rendered must come from POST /api/pricing/quote. These helpers
 * produce *labels* ("Buy 3+ · ৳500 off", "Add 2 more for free delivery") and
 * read the discount that the server already applied — they never derive one.
 *
 * The quote returns only the net `unitPrice`; it doesn't say which discount
 * won (sale vs quantity offer never stack — the cheaper wins). So the reason
 * shown is inferred from the product's own fields, and is only ever displayed
 * when the server's own numbers confirm a discount was applied.
 */

import type { FreeDeliveryOffer, Product, QuantityOffer } from "@/lib/products";
import type { QuoteLine } from "@/lib/quote";
import { formatBDT } from "@/lib/site";

/** Both offer kinds are `{minQty, amount}` ladders resolved the same way
 *  (highest satisfied tier wins, never stacked), so they share these two
 *  searches — mirroring `bestOfferTier` in the backend's lib/rules.ts. */
interface OfferTier {
  minQty: number;
  amount: number;
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
  const saleOff = saleAmount(product);

  // Sale and quantity offers never stack — whichever is cheaper wins. When an
  // offer tier applies and is at least as good, credit the tier.
  if (offer && offer.amount >= saleOff) {
    return `Buy ${offer.minQty}+ · ${formatBDT(offer.amount)} off`;
  }
  if (saleOff > 0) return `Sale · ${formatBDT(saleOff)} off`;
  return "Discounted";
}

/** Savings versus the regular price, from the server's own line total. */
export function lineSavings(product: Product, line: QuoteLine): number {
  return Math.max(0, product.price * line.qty - line.lineTotal);
}

export interface FreeDeliveryState {
  /** Delivery is free for this line. */
  free: boolean;
  /** BDT off the delivery fee the current qty has earned. */
  discountAmount: number;
  /** Units still needed to reach the next tier, when there is one. */
  unitsAway: number | null;
  /** What that next tier is worth, so the nudge can name the reward. */
  nextAmount: number | null;
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
    return { free: true, discountAmount: earned?.amount ?? 0, unitsAway: null, nextAmount: null };
  }

  return {
    free: false,
    discountAmount: earned?.amount ?? 0,
    unitsAway: next ? next.minQty - line.qty : null,
    nextAmount: next?.amount ?? null,
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

/** "Buy 3+ save ৳500 · Buy 5+ save ৳1,200" — available tiers, for product pages
 *  where no quantity is chosen yet. */
export function offerTiersLabel(offers: QuantityOffer[] | undefined): string | null {
  if (!offers?.length) return null;
  return [...offers]
    .sort((a, b) => a.minQty - b.minQty)
    .map((o) => `Buy ${o.minQty}+ save ${formatBDT(o.amount)}`)
    .join(" · ");
}

/** "Buy 2+ half delivery · Buy 5+ free delivery" — the delivery ladder. */
export function deliveryTierLabel(
  offers: FreeDeliveryOffer[] | undefined,
  product: Product,
): string | null {
  if (!offers?.length) return null;
  return [...offers]
    .sort((a, b) => a.minQty - b.minQty)
    .map((o) => `Buy ${o.minQty}+ ${deliveryRewardLabel(o.amount, product)}`)
    .join(" · ");
}

/**
 * "free delivery" when the tier covers the fee, otherwise the amount off.
 *
 * Which fee it covers depends on the delivery zone, and this runs before a
 * zone is known — so it reads free only when the amount clears BOTH zone fees.
 * Claiming free delivery a customer outside Dhaka won't get is the one error
 * worth being conservative about.
 */
function deliveryRewardLabel(amount: number, product: Product): string {
  const dearest = Math.max(
    product.deliveryFeeInsideDhaka ?? 0,
    product.deliveryFeeOutsideDhaka ?? 0,
  );
  if (dearest > 0 && amount >= dearest) return "free delivery";
  return `${formatBDT(amount)} off delivery`;
}

/** How much the sale takes off, in Taka. Both figures are admin-entered, so
 *  this is a subtraction of two stored numbers, not a derived price. */
export function saleAmount(product: Product): number {
  if (!product.onSale || product.salePrice === undefined) return 0;
  return Math.max(0, product.price - product.salePrice);
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
  /** What the rung is worth to the customer, in Taka — for a quantity tier
   *  that is the drop from the price currently shown, NOT the tier's stored
   *  amount (which is measured off the list price and may be partly or wholly
   *  swallowed by an existing sale). For delivery, an amount at or above the
   *  zone fee means it ships free. */
  amount: number;
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
  const saleOff = saleAmount(product);

  if (saleOff > 0) {
    rungs.push({
      kind: "sale",
      minQty: null,
      amount: saleOff,
      label: `${formatBDT(saleOff)} off`,
      detail: "On every unit, no minimum",
      state: "active", // a flat sale needs no quantity to qualify
      unitsAway: null,
    });
  }

  /*
   * A tier's stored `amount` is taka off the LIST price, and the backend then
   * charges min(sellingPrice, price - amount) — tiers and sales never stack,
   * the cheaper wins (rules.ts `effectiveUnitPrice`). So on a product that is
   * ALSO on sale, `amount` is not what the customer saves: they are already
   * paying the sale price, and only the part of the tier that goes below it is
   * worth anything.
   *
   * Printing the raw amount claimed a discount that was not given — a ৳600
   * tier on a product listed at ৳2,600 and on sale at ৳2,184 says "Save ৳600"
   * while the basket falls by ৳184. Worse, a tier that does not reach the sale
   * price at all is worth exactly nothing and still advertised itself.
   *
   * So: state the saving against the price actually shown, and drop rungs that
   * are worth nothing rather than promise a discount the cart will not give.
   */
  const shownUnitPrice = product.price - saleOff;
  for (const offer of [...(product.quantityOffers ?? [])].sort((a, b) => a.minQty - b.minQty)) {
    const tierUnitPrice = Math.max(0, product.price - offer.amount);
    const realSaving = Math.max(0, shownUnitPrice - tierUnitPrice);
    if (realSaving === 0) continue;
    const earned = qty !== undefined && qty >= offer.minQty;
    rungs.push({
      kind: "qty",
      minQty: offer.minQty,
      // The rung's worth, which is what every caller renders and totals.
      amount: realSaving,
      label: `Buy ${offer.minQty}+`,
      detail: `Save ${formatBDT(realSaving)} per unit`,
      state: earned ? "active" : "locked",
      unitsAway: qty !== undefined && !earned ? offer.minQty - qty : null,
    });
  }

  for (const offer of [...(product.freeDeliveryOffers ?? [])].sort((a, b) => a.minQty - b.minQty)) {
    const earned = qty !== undefined && qty >= offer.minQty;
    rungs.push({
      kind: "delivery",
      minQty: offer.minQty,
      amount: offer.amount,
      label: `Buy ${offer.minQty}+`,
      detail: deliveryRewardLabel(offer.amount, product).replace(/^./, (c) => c.toUpperCase()),
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
