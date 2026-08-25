/**
 * The dataLayer the GTM container reads.
 *
 * GTM can already see raw clicks by itself — its built-in listeners sit on the
 * document, so "which button was pressed" is answerable from Click Text /
 * Click Classes without any help from us. What it CANNOT infer is meaning:
 * that a click was an add-to-cart worth ৳2,100, that a page changed without a
 * page load, or that an order completed. Those are pushed from here.
 *
 * Event names and payload shape follow GA4's recommended e-commerce schema
 * (view_item, add_to_cart, begin_checkout, purchase, …) rather than anything
 * invented, so a standard GA4 tag in GTM picks them up with no mapping and the
 * reports populate themselves. Deviating here would mean hand-building every
 * report from custom dimensions.
 */

/** One line item, in the shape GA4 expects. */
export interface TrackedItem {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
}

interface DataLayerWindow extends Window {
  dataLayer?: Record<string, unknown>[];
}

/**
 * Push one event, safely.
 *
 * Silent when there is no dataLayer — that is the normal state on the server,
 * in tests, and for any visitor whose blocker removed GTM. Analytics must
 * never be able to break a page, so this swallows its own failures: a broken
 * measurement is worth strictly less than a working checkout.
 */
export function track(event: string, payload: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    const w = window as DataLayerWindow;
    w.dataLayer = w.dataLayer ?? [];
    // `ecommerce: null` first is GA4's documented way to stop the previous
    // event's items leaking into this one — the dataLayer persists, so without
    // it a purchase can inherit the items of an earlier add_to_cart.
    if ("ecommerce" in payload) w.dataLayer.push({ ecommerce: null });
    w.dataLayer.push({ event, ...payload });
  } catch {
    /* never let measurement break the page */
  }
}

/** Money is integer BDT everywhere in this codebase; GA4 wants a currency. */
export const CURRENCY = "BDT";

/**
 * The same event, in the shape Meta's Pixel expects.
 *
 * GA4 and Meta disagree about names for identical facts: GA4 says
 * `items[].item_id`, Meta says `content_ids` — a flat array — plus `contents`
 * with `item_price`. GTM cannot bridge that with field mapping alone; it needs
 * a Custom JavaScript variable per field, which is where most Pixel setups
 * quietly go wrong. The usual symptom is a Pixel that reports Purchases with a
 * value but no content_ids, so the numbers look fine in Events Manager while
 * dynamic-ads retargeting never matches a single product.
 *
 * Emitting both shapes costs a few bytes per event and turns the Meta tag into
 * plain field mapping: point content_ids at `meta.content_ids` and stop.
 * Additive, so nothing about the GA4 payload changes.
 */
function metaBlock(items: TrackedItem[], value: number) {
  return {
    content_type: "product",
    content_ids: items.map((i) => i.item_id),
    contents: items.map((i) => ({
      id: i.item_id,
      quantity: i.quantity,
      item_price: i.price,
    })),
    num_items: items.reduce((n, i) => n + i.quantity, 0),
    value,
    currency: CURRENCY,
  };
}

export const trackViewItem = (item: TrackedItem) =>
  track("view_item", {
    ecommerce: { currency: CURRENCY, value: item.price, items: [item] },
    meta: metaBlock([item], item.price),
  });

export const trackAddToCart = (item: TrackedItem) =>
  track("add_to_cart", {
    ecommerce: { currency: CURRENCY, value: item.price * item.quantity, items: [item] },
    meta: metaBlock([item], item.price * item.quantity),
  });

export const trackRemoveFromCart = (item: TrackedItem) =>
  track("remove_from_cart", {
    ecommerce: { currency: CURRENCY, value: item.price * item.quantity, items: [item] },
    meta: metaBlock([item], item.price * item.quantity),
  });

export const trackBeginCheckout = (items: TrackedItem[], value: number) =>
  track("begin_checkout", {
    ecommerce: { currency: CURRENCY, value, items },
    meta: metaBlock(items, value),
  });

/**
 * The order completed.
 *
 * `customer` carries Meta's Advanced Matching fields — already hashed, see
 * lib/customer-match.ts — under the variable names both GTM containers were
 * built to read and which this site had never once pushed. They go in their
 * OWN push, before the event, because a GTM variable is resolved at the moment
 * its tag fires: values arriving in the same push as `purchase` are a race, and
 * values arriving after it are simply too late.
 */
export const trackPurchase = (
  transaction_id: string,
  value: number,
  items: TrackedItem[],
  extra: Record<string, unknown> = {},
  customer?: Readonly<Record<string, string | undefined>>,
) => {
  // Undefined values are dropped: an empty field is one Meta would try to
  // match on and fail, which reads as a worse signal than no field at all.
  const present = Object.fromEntries(
    Object.entries(customer ?? {}).filter(([, v]) => typeof v === "string" && v !== ""),
  );
  if (Object.keys(present).length > 0) track("customer_data", present);
  track("purchase", {
    ecommerce: { transaction_id, currency: CURRENCY, value, items, ...extra },
    // Meta dedupes on this when the Conversions API is added server-side later.
    meta: { ...metaBlock(items, value), order_id: transaction_id },
  });
};
