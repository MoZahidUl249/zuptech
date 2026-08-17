"use client";

import { useEffect } from "react";
import { track, trackViewItem } from "@/lib/analytics";

/**
 * What a campaign page reports to its own GTM container.
 *
 * A landing page is one document with no client-side navigation, so the
 * container's initial page_view already covers the visit. What it does NOT
 * cover is which campaign, which product, and which of the four identical
 * "order" buttons a visitor actually pressed — and on an ad landing page that
 * last one is the whole question. Four CTAs all point at #order, so a raw
 * Click Text trigger reports the same label for every one of them and cannot
 * tell you whether the hero converts or only the countdown does.
 *
 * Clicks are caught by one delegated listener rather than handlers on each
 * anchor: the page is a server component, and this keeps it that way instead
 * of turning four buttons into four client islands.
 *
 * Heatmap and session-replay tools (Clarity, Hotjar) need nothing from here —
 * they attach their own listeners once GTM loads them, and the CSP now allows
 * their scripts and sockets. This is for the events they cannot label.
 */
export function CampaignTracking({
  slug,
  productId,
  productName,
  price,
}: {
  slug: string;
  productId: string;
  productName: string;
  price: number;
}) {
  useEffect(() => {
    /* campaign_view carries the slug so one container can serve every
       campaign and still report them apart. */
    track("campaign_view", { campaign_slug: slug, campaign_product: productId });
    trackViewItem({ item_id: productId, item_name: productName, price, quantity: 1 });
  }, [slug, productId, productName, price]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-cta]");
      if (!el) return;
      track("cta_click", {
        campaign_slug: slug,
        // Which band of the page it sits in — hero, price, countdown, form.
        cta_location: el.dataset.cta,
        cta_text: (el.textContent ?? "").trim().slice(0, 80),
      });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [slug]);

  return null;
}
