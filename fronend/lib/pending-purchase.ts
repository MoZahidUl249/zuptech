import type { TrackedItem } from "@/lib/analytics";
import type { CustomerMatch } from "@/lib/customer-match";

/**
 * The Purchase event for an order that left the site to be paid for.
 *
 * Checkout cannot fire Purchase when it sends someone to a payment gateway:
 * nothing has been paid at that moment, and counting it would make every
 * abandoned gateway page look like revenue. So the event is parked here and
 * fired by the return page, after the backend has confirmed with the gateway
 * that money actually moved.
 *
 * Session storage on purpose — this belongs to one tab and one checkout, and
 * must not survive them. Everything stored is already in the customer's own
 * browser (their cart, their order id) or hashed (the match keys), so nothing
 * here is a secret; it is still cleared the moment it is used.
 */
export const PENDING_PURCHASE_KEY = "zup:pending-purchase";

export interface PendingPurchase {
  orderId: string;
  total: number;
  items: TrackedItem[];
  params: { payment_type: string; shipping: number };
  customerMatch: CustomerMatch;
}

/** Read and remove the parked event. Returns null when there isn't one. */
export function takePendingPurchase(orderId: string): PendingPurchase | null {
  try {
    const raw = sessionStorage.getItem(PENDING_PURCHASE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_PURCHASE_KEY);

    const parsed = JSON.parse(raw) as PendingPurchase;
    // Guard against a stale event from an earlier checkout in the same tab:
    // attributing this payment to the previous order would be worse than
    // reporting nothing.
    return parsed.orderId === orderId ? parsed : null;
  } catch {
    return null;
  }
}
