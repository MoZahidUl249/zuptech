"use client";

/*
 * What a guest has typed at checkout, kept in localStorage.
 *
 * Checkout used to be three `useState` steps, so a refresh — or a tap on a
 * payment app and back — threw away the name, phone and address the customer
 * had just entered and dropped them at step one. Persisting the draft is what
 * makes the single-page form safe to leave and come back to.
 *
 * Signed-in customers don't need this: their details come from the account.
 * The draft is cleared the moment an order is placed.
 *
 * Same storage discipline as lib/zone.ts and lib/cart.tsx — every access is
 * wrapped, because private-browsing modes throw on localStorage.
 */

const STORAGE_KEY = "zup-checkout-draft";

export interface CheckoutDraft {
  name: string;
  phone: string;
  address: string;
  landmark: string;
}

export const EMPTY_DRAFT: CheckoutDraft = { name: "", phone: "", address: "", landmark: "" };

export function readDraft(): CheckoutDraft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DRAFT;
    const parsed = JSON.parse(raw) as Partial<CheckoutDraft>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
      address: typeof parsed.address === "string" ? parsed.address : "",
      landmark: typeof parsed.landmark === "string" ? parsed.landmark : "",
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function writeDraft(draft: CheckoutDraft) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // storage unavailable — the draft just doesn't survive a refresh
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clean up
  }
}
