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

export const trackViewItem = (item: TrackedItem) =>
  track("view_item", { ecommerce: { currency: CURRENCY, value: item.price, items: [item] } });

export const trackAddToCart = (item: TrackedItem) =>
  track("add_to_cart", {
    ecommerce: { currency: CURRENCY, value: item.price * item.quantity, items: [item] },
  });

export const trackRemoveFromCart = (item: TrackedItem) =>
  track("remove_from_cart", {
    ecommerce: { currency: CURRENCY, value: item.price * item.quantity, items: [item] },
  });

export const trackBeginCheckout = (items: TrackedItem[], value: number) =>
  track("begin_checkout", { ecommerce: { currency: CURRENCY, value, items } });

export const trackPurchase = (
  transaction_id: string,
  value: number,
  items: TrackedItem[],
  extra: Record<string, unknown> = {},
) =>
  track("purchase", {
    ecommerce: { transaction_id, currency: CURRENCY, value, items, ...extra },
  });
