"use client";

import { useSyncExternalStore } from "react";
import { GTM_ID_RE, type HeroSlide, type SiteContact, type SiteCopy } from "@/lib/admin";
import { featuredProducts, type Product } from "@/lib/products";
import { getProductsByIds, getSiteConfig, type PaymentOption, type SiteConfig } from "@/lib/api";
import { site } from "@/lib/site";
import { DEFAULT_COPY, resolveCopy } from "@/lib/site-copy";

/*
 * Read-only bridge from the backend's public site config to the storefront.
 * Server render (and the moment before the first fetch resolves) falls back
 * to the static defaults, so SEO output is unchanged; the browser swaps in
 * the backend values once GET /api/site-config and GET /api/products
 * resolve, and refreshes on window focus.
 */

let config: SiteConfig | null = null;
let featured: Product[] | null = null;
let started = false;
let fetching = false;

const listeners = new Set<() => void>();

/*
 * Two requests, in order — the config names the featured ids, then those ids
 * are fetched directly.
 *
 * This used to fetch the config and the whole catalog in parallel and pick the
 * featured rows out of it in the browser. That was one wasteful request while
 * `GET /api/products` still answered with everything; once the route was paged
 * it became `ceil(total / 200)` parallel requests — 23 at 4,500 products —
 * fired by every browser that opened the home page, to render six cards. It
 * was also, almost certainly, most of the 429s in the load test.
 *
 * Sequential costs one extra round trip and is still the right trade: the ids
 * are not knowable until the config lands, and two small requests beat
 * twenty-four large ones.
 */
async function load() {
  if (fetching) return;
  fetching = true;
  try {
    const nextConfig = await getSiteConfig();
    if (nextConfig) config = nextConfig;
    featured = config ? await getProductsByIds(config.featuredIds) : null;
    listeners.forEach((l) => l());
  } finally {
    fetching = false;
  }
}

function refresh() {
  void load();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  if (!started && typeof window !== "undefined") {
    started = true;
    window.addEventListener("focus", refresh);
    void load();
  }
  return () => {
    listeners.delete(callback);
  };
}

/* ===== Featured products ===== */

let featuredCache: Product[] | null = null;
let featuredCacheKey = "";

function getFeaturedSnapshot(): Product[] {
  if (!config || !featured) return featuredProducts;
  const key = config.featuredIds.join(",") + "|" + featured.length;
  if (featuredCache && featuredCacheKey === key) return featuredCache;
  featuredCacheKey = key;
  // Ordered by featuredIds, not by whatever order the API returned — the admin
  // controls the sequence the cards appear in.
  featuredCache = config.featuredIds
    .map((id) => featured!.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p));
  if (featuredCache.length === 0) featuredCache = featuredProducts;
  return featuredCache;
}

export function useFeaturedProducts(): Product[] {
  return useSyncExternalStore(subscribe, getFeaturedSnapshot, () => featuredProducts);
}

/* ===== Hero slides ===== */

export const DEFAULT_SLIDES: HeroSlide[] = [
  {
    id: "sl1",
    image: "/images/banner-power-solutions.png",
    cta: "Shop Products",
    href: "/shop",
    active: true,
    fit: "cover",
    bg: "linear-gradient(115deg,#0B4FE0 0%,#083A9E 100%)",
  },
  {
    id: "sl2",
    image: "/images/banner-engineering-services.png",
    cta: "Explore Services",
    href: "/services",
    active: true,
    fit: "contain",
    bg: "linear-gradient(115deg,#DDE7F3 0%,#F5F8FC 100%)",
  },
];

let slidesCache: HeroSlide[] | null = null;
let slidesCacheKey = "";

function getSlidesSnapshot(): HeroSlide[] {
  const slides = config?.slides;
  if (!slides) return DEFAULT_SLIDES;
  const active = slides.filter((s) => s.active && s.image);
  if (active.length === 0) return DEFAULT_SLIDES;
  const key = JSON.stringify(active);
  if (slidesCache && slidesCacheKey === key) return slidesCache;
  slidesCacheKey = key;
  slidesCache = active;
  return slidesCache;
}

export function useHeroSlides(): HeroSlide[] {
  return useSyncExternalStore(subscribe, getSlidesSnapshot, () => DEFAULT_SLIDES);
}

/* ===== Payment methods (checkout options) ===== */

export type { PaymentOption };

export const DEFAULT_PAY_OPTIONS: PaymentOption[] = [
  { label: "bKash", sub: "Pay instantly from your bKash wallet" },
  { label: "Nagad", sub: "Pay instantly from your Nagad wallet" },
  { label: "Cash on Delivery", sub: "Pay when your order arrives" },
];

function getPaySnapshot(): PaymentOption[] {
  const options = config?.paymentOptions;
  return options && options.length > 0 ? options : DEFAULT_PAY_OPTIONS;
}

export function usePaymentOptions(): PaymentOption[] {
  return useSyncExternalStore(subscribe, getPaySnapshot, () => DEFAULT_PAY_OPTIONS);
}

/* ===== Delivery districts (from admin shipping charges) ===== */

/** All 64 districts of Bangladesh — mirrors backend/src/lib/rules.ts
 *  DISTRICTS, used only as the pre-fetch/offline fallback. */
/* ===== Contact info ===== */

export const DEFAULT_CONTACT: SiteContact = {
  phone: site.phone,
  phoneDisplay: site.phoneDisplay,
  hotline: "09612-345678",
  email: site.email,
  whatsapp: "8801700000000",
  street: site.address.street,
  city: site.address.city,
  postalCode: site.address.postalCode,
  hours: site.hours,
  // Office-card fields: blank rather than invented. The contact page hides a
  // row it has no value for, which is the honest failure mode when the backend
  // is unreachable — a fabricated warehouse address is not.
  officeName: site.name,
  warehouseName: "",
  warehouseAddress: "",
  hoursWeekday: "",
  hoursWeekend: "",
  hoursEmergency: "",
};

function getContactSnapshot(): SiteContact {
  return config?.contact ?? DEFAULT_CONTACT;
}

export function useSiteContact(): SiteContact {
  return useSyncExternalStore(subscribe, getContactSnapshot, () => DEFAULT_CONTACT);
}

export function waLink(whatsappDigits: string): string {
  return `https://wa.me/${whatsappDigits.replace(/\D/g, "")}`;
}

/* ===== Site copy (admin-editable headings and paragraphs) ===== */

export { DEFAULT_COPY, resolveCopy };

// Memoized on a serialized key: useSyncExternalStore re-renders forever if
// getSnapshot returns a fresh object each call (same reason getSlidesSnapshot
// caches above).
let copyCache: SiteCopy | null = null;
let copyCacheKey = "";

function getCopySnapshot(): SiteCopy {
  const copy = config?.copy;
  if (!copy) return DEFAULT_COPY;
  const key = JSON.stringify(copy);
  if (copyCache && copyCacheKey === key) return copyCache;
  copyCacheKey = key;
  copyCache = resolveCopy(copy);
  return copyCache;
}

/** For client components. Server components should call getSiteConfig()
 *  directly and pass the result through resolveCopy() — that keeps the copy in
 *  the SSR HTML, so it's SEO-visible with no post-hydration swap. */
export function useSiteCopy(): SiteCopy {
  return useSyncExternalStore(subscribe, getCopySnapshot, () => DEFAULT_COPY);
}

/* ===== Google Tag Manager ===== */

function getGtmSnapshot(): string | null {
  const gtm = config?.gtm;
  const raw = typeof gtm === "string" ? gtm : (gtm?.id ?? null);
  if (!raw) return null;
  const id = raw.trim().toUpperCase();
  return GTM_ID_RE.test(id) ? id : null;
}

/** The active GTM container id, or null when disabled/unset/invalid. */
export function useGtmId(): string | null {
  return useSyncExternalStore(subscribe, getGtmSnapshot, () => null);
}
