"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";

/**
 * A page_view on every route change, not just the first load.
 *
 * This is the gap nobody notices until the reports are wrong. GTM fires its
 * container once per document, and Next's App Router navigates without one —
 * so a visitor who lands on the home page and browses six products registers
 * as a single page view on the home page. Every downstream number inherits
 * that: bounce rate, pages per session, which product pages actually get seen.
 *
 * GTM's built-in History Change trigger can catch pushState too, but it fires
 * before React has committed the new page, so the title and any page-level
 * variables still describe the PREVIOUS route. Pushing from an effect means
 * the values are read after the new page exists.
 *
 * The first render is deliberately skipped: the container's own initial
 * page_view already covers the landing page, and firing here as well would
 * double-count every session's first hit.
 */
export function AnalyticsRouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const query = searchParams.toString();
    track("page_view", {
      page_path: query ? `${pathname}?${query}` : pathname,
      page_title: document.title,
      page_location: window.location.href,
    });
  }, [pathname, searchParams]);

  return null;
}
