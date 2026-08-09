import type { HeroPage, HeroSlide } from "@/lib/admin";

/**
 * Hero slide resolution, shared by the server render and the client store.
 *
 * Deliberately NOT a "use client" module. The pages render their hero on the
 * server — they already fetch the site config for their copy, so the slides are
 * right there — and only a plain module can be imported from both sides.
 *
 * Before this, the hero was resolved solely in the browser: the server emitted
 * the built-in banners, the client fetched the config, and the real art
 * replaced it a moment later. Every refresh flashed the default banner, on the
 * largest element on the page.
 */

/**
 * Built-in art, used by any page with no slides of its own.
 *
 * Each is tagged with the pages it suits, so an unconfigured /services does not
 * fall back to a power-products banner. This is only ever a fallback — the
 * moment the admin assigns a real slide to a page, that page stops using these.
 */
export const DEFAULT_SLIDES: HeroSlide[] = [
  {
    id: "sl1",
    image: "/images/banner-power-solutions.png",
    cta: "Shop Products",
    href: "/shop",
    active: true,
    fit: "cover",
    bg: "linear-gradient(115deg,#0B4FE0 0%,#083A9E 100%)",
    pages: ["home", "industrial"],
  },
  {
    id: "sl2",
    image: "/images/banner-engineering-services.png",
    cta: "Explore Services",
    href: "/services",
    active: true,
    fit: "contain",
    bg: "linear-gradient(115deg,#DDE7F3 0%,#F5F8FC 100%)",
    pages: ["home", "services"],
  },
];

/** Slides assigned to `page`, treating an untagged slide as a home slide —
 *  that is where every slide rendered before pages existed. */
export function forPage(slides: HeroSlide[], page: HeroPage): HeroSlide[] {
  return slides.filter((s) => (s.pages?.length ? s.pages.includes(page) : page === "home"));
}

/**
 * The per-page fallbacks, built ONCE.
 *
 * These have to be stable references for the client store: useSyncExternalStore
 * re-renders whenever the snapshot changes identity, so returning a freshly
 * filtered array meant a new array every render and an infinite loop — React
 * error #185, with the whole page failing to hydrate. Filtering a constant per
 * call looks free and is not.
 */
export const DEFAULTS_BY_PAGE: Record<HeroPage, HeroSlide[]> = {
  home: forPage(DEFAULT_SLIDES, "home"),
  services: forPage(DEFAULT_SLIDES, "services"),
  industrial: forPage(DEFAULT_SLIDES, "industrial"),
};

/**
 * The slides one page should show, from a site config that may be missing.
 *
 * The single place this decision is made, so the server render and the client
 * store can never disagree — a mismatch between them is a hydration error, and
 * this is the value that would differ.
 */
export function resolveSlides(
  configSlides: HeroSlide[] | undefined | null,
  page: HeroPage,
): HeroSlide[] {
  if (!configSlides) return DEFAULTS_BY_PAGE[page];
  // Only active slides that actually carry art — a slide with no image would
  // render an empty frame.
  const active = forPage(
    configSlides.filter((s) => s.active && s.image),
    page,
  );
  return active.length > 0 ? active : DEFAULTS_BY_PAGE[page];
}
