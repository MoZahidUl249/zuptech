/*
 * Admin-editable site copy: the shipped defaults and the merge rule.
 *
 * Deliberately NOT a client module — server components (the home, industrial
 * and contact pages) call resolveCopy() directly so the copy lands in the SSR
 * HTML, where it's SEO-visible and doesn't swap after hydration. The client
 * hook that wraps this lives in lib/admin-bridge.ts.
 */

import type { SiteCopy } from "@/lib/admin";
import { site } from "@/lib/site";

/**
 * The copy the site ships with. Every admin-editable field falls back to one
 * of these, so a fresh database (all columns default to "") or an unreachable
 * backend still renders real text instead of empty headings.
 */
export const DEFAULT_COPY: SiteCopy = {
  footerDescription: site.tagline,

  // One headline per page — each page's <h1>, hidden on the ones whose hero is
  // the banner carousel.
  homeHeroHeadline: "Intelligent Energy & Electrical Infrastructure",
  servicesHeroHeadline: "Integrated Energy Solutions",
  industrialHeroHeadline: "Powering Global Infrastructure",

  contactHeading: "Talk to us",
  contactFormHeading: "Or send a message",
  contactOfficeHeading: "Head Office",
  // No default: these are the client's own numbers, and inventing one would
  // put a fake service line on a real contact page. Blank hides the row.
  contactServiceLine: "",
  contactTendersEmail: "",
};

/**
 * Merge admin values over the defaults.
 *
 * Coalesces per field rather than spreading: every copy column defaults to ""
 * in Postgres, so a plain `{...DEFAULT_COPY, ...copy}` would blank every
 * heading on a fresh database.
 */
export function resolveCopy(copy?: Partial<SiteCopy> | null): SiteCopy {
  if (!copy) return DEFAULT_COPY;
  const out = { ...DEFAULT_COPY };
  for (const key of Object.keys(DEFAULT_COPY) as (keyof SiteCopy)[]) {
    const v = copy[key];
    if (typeof v === "string" && v.trim()) out[key] = v;
  }
  return out;
}

