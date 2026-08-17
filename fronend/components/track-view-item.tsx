"use client";

import { useEffect } from "react";
import { trackViewItem } from "@/lib/analytics";

/**
 * Reports that this product was actually looked at.
 *
 * A client island rather than a call inside the page, because the product page
 * is a server component — there is no dataLayer there, and making the whole
 * page client-side to fire one event would cost the pre-rendered HTML that
 * makes it fast and indexable.
 */
export function TrackViewItem({
  id,
  name,
  price,
}: {
  id: string;
  name: string;
  price: number;
}) {
  useEffect(() => {
    trackViewItem({ item_id: id, item_name: name, price, quantity: 1 });
  }, [id, name, price]);
  return null;
}
