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
  featuredHeading: "Featured Equipment",
  servicesHeading: "Engineering Services",
  servicesSubtitle:
    "Design, installation and maintenance for power and electrical infrastructure across Bangladesh.",
  footerDescription: site.tagline,

  homeHeroEyebrow: "Future-proof power",
  homeHeroHeadline: "Intelligent Energy & Electrical Infrastructure",
  homeHeroSubhead:
    "Expert solutions for industrial substations, smart building management, and sustainable solar energy — engineered and maintained across Bangladesh.",
  homeIndustrialEyebrow: "Industrial infrastructure",
  homeIndustrialHeading: "Built for continuous operation",
  homeCapabilitiesEyebrow: "What we do",
  homeCapabilitiesHeading: "Specialist Capabilities",
  homeCtaHeading: "Ready to Power Your Project?",
  homeCtaSubtext:
    "Tell us what you need and our engineers will scope it with you — no obligation.",
  homeCtaButton: "Request a Quote",

  industrialHeroEyebrow: "Industrial & infrastructure",
  industrialHeroHeadline: "Powering Global Infrastructure",
  industrialHeroSubhead:
    "High-voltage systems, smart grids and turnkey distribution — designed, commissioned and maintained to industrial standards.",
  industrialGridHeading: "High-Voltage Grid Solutions",
  industrialGridBody:
    "From substation design through commissioning and long-term maintenance, we deliver the infrastructure heavy operations depend on.",
  industrialServicesHeading: "Core Infrastructure Services",
  industrialServicesSubtitle:
    "End-to-end capability across design, build, commissioning and maintenance.",
  industrialStandardsHeading: "Operational Standards",
  industrialStandardsBody: "The design targets we engineer and commission against.",

  contactHeading: "Talk to us",
  contactFormHeading: "Or send a message",
  contactOfficeHeading: "Head Office",
  contactTeamHeading: "Meet the team",
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

