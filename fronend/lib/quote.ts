"use client";

import { useEffect, useState } from "react";

// The browser never computes money. Every amount shown in the UI comes from
// POST /api/pricing/quote (see cal-bk.md). This hook is the only pricing
// seam on the client.
//
// A campaign page passes its slug, because a campaign may carry its own bulk
// prices and the quote has to ask the same question the order will ask. The
// slug is part of the cache key below for that reason: it changes the answer.

export interface QuoteItem {
  productId: string;
  qty: number;
}

export interface QuoteLine extends QuoteItem {
  /** Effective per-unit price after whichever discount won (sale vs quantity
   *  offer — they never stack; the API doesn't say which applied). */
  unitPrice: number;
  lineTotal: number;
  /** Per unit. null until the delivery zone is known; 0 when this line hit its
   *  free-delivery threshold. */
  deliveryFee: number | null;
  /** Per unit. null until the delivery zone is known. */
  installationFee: number | null;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  /** null until a delivery zone is known (cart page vs checkout). */
  deliveryFee: number | null;
  installationFee: number | null;
  total: number | null;
  insideDhaka: boolean | null;
}

interface QuoteResult {
  key: string;
  quote: Quote | null;
  error: boolean;
}

/**
 * @param insideDhaka Delivery zone. Omit it and the API returns null fees and
 *   a null total — the backend prices delivery/installation as a two-tier
 *   inside/outside-Dhaka boolean, not a location id.
 * @param landingPageSlug The campaign this cart is being priced for, when it
 *   is one. A published campaign may price its own product differently, so a
 *   quote taken without the slug is a different quote — not a stale one.
 */
export function useQuote(items: QuoteItem[], insideDhaka?: boolean, landingPageSlug?: string) {
  // Serialize so the effect re-runs on content change, not array identity.
  // The campaign belongs IN the key: without it, a quote fetched before the
  // slug was known would be surfaced as an answer to a question it never
  // asked, which is how a form ends up showing a price checkout will not take.
  const key = JSON.stringify({ items, insideDhaka, landingPageSlug });
  const [result, setResult] = useState<QuoteResult | null>(null);

  useEffect(() => {
    const { items, insideDhaka, landingPageSlug } = JSON.parse(key) as {
      items: QuoteItem[];
      insideDhaka?: boolean;
      landingPageSlug?: string;
    };
    if (items.length === 0) return;
    const ctrl = new AbortController();
    fetch("/api/pricing/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, insideDhaka, landingPageSlug }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((q: Quote) => setResult({ key, quote: q, error: false }))
      .catch(() => {
        if (!ctrl.signal.aborted) setResult({ key, quote: null, error: true });
      });
    return () => ctrl.abort();
  }, [key]);

  // Only surface a result that matches the current cart contents — a stale
  // or in-flight quote renders as loading, never as a wrong amount.
  const current = items.length > 0 && result?.key === key ? result : null;
  return { quote: current?.quote ?? null, error: current?.error ?? false };
}

/** Cart map → quote items, in a stable order. */
export function cartToItems(cart: Record<string, number>): QuoteItem[] {
  return Object.entries(cart)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([productId, qty]) => ({ productId, qty }));
}
