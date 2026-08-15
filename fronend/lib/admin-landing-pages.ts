"use client";

import { useCallback, useEffect, useState } from "react";
import { unwrap } from "@/lib/admin-http";
import { api } from "@/lib/eden";
import { whole } from "@/lib/utils";

/** Row shape of GET /admin/api/landing-pages (LandingPageDto). */
export interface LandingPage {
  id: string;
  /** Internal admin name — never shown to visitors. */
  title: string;
  /** The public <h1>. "" falls back to the product name server-side. */
  headline: string;
  slug: string;
  productId: string;
  /** Resolved server-side for display. */
  productName: string;
  productSlug: string;
  /**
   * false = the product is off the storefront and this page is the only way
   * to buy it, so unpublishing here also closes checkout for it.
   */
  productVisible: boolean;
  /**
   * What checkout actually charges per unit. `offerPrice` is campaign copy —
   * the backend never prices from it — so the editor warns when they differ.
   */
  productSellingPrice: number;
  offerPrice: number;
  compareAtPrice: number;
  ribbonText: string;
  buttonLabel: string;
  footerNote: string;
  benefitBullets: string[];
  imageHint: string;
  gtmId: string;
  published: boolean;

  /* ===== Campaign page content =====
   * Every visitor-facing string on /lp/:slug. None of it is money — the bundle
   * prices the page shows are derived server-side from the product's quantity
   * offers, so a campaign can never advertise a total the cart won't charge. */
  hotlineLabel: string;
  hotlineNumber: string;
  headerCtaLabel: string;
  trustBadges: string[];
  subheadline: string;
  discountBadge: string;
  heroCtaNote: string;
  brandStripTitle: string;
  brandLogos: string[];
  videoTitle: string;
  videoUrl: string;
  featuresTitle: string;
  features: { title: string; body: string }[];
  specTitle: string;
  specMeta: string;
  specs: { value: string; label: string }[];
  bundlesTitle: string;
  bundlesSubtitle: string;
  bundleUnitLabel: string;
  bundleMaxQty: number;
  qcTitle: string;
  qcBody: string;
  qcPoints: string[];
  qcImageHint: string;
  countdownTitle: string;
  countdownNote: string;
  /** ISO timestamp, or "" for no deadline. */
  countdownEndsAt: string;
  countdownCtaLabel: string;
  countdownAssurance: string;
  testimonialsTitle: string;
  testimonials: { quote: string; name: string; location: string }[];
  formTitle: string;
  formIntro: string;
  formLabels: {
    name: string;
    phone: string;
    address: string;
    packageLabel: string;
    deliveryLabel: string;
    totalLabel: string;
    submit: string;
    namePlaceholder: string;
    phonePlaceholder: string;
    addressPlaceholder: string;
    successMessage: string;
  };
  footerTagline: string;
  footerAbout: string;
  footerLines: string[];

  /* ===== Theme =====
   * Every colour the page paints with, named for the ROLE it plays rather than
   * the colour it holds — a campaign can be recoloured without a name turning
   * into a lie. Hex strings; the server validates the format. */
  colorHeroBg: string;
  colorHeroText: string;
  colorBandBg: string;
  colorBandText: string;
  colorTintBg: string;
  colorPageBg: string;
  colorPageText: string;
  colorAccent: string;
  colorHighlight: string;
  colorCtaBg: string;
  colorCtaText: string;

  /** Ordered product ids for the row above the page body. Empty hides it. */
  productRowIds: string[];
  /** The two price-band labels. Blank falls back to English in the renderer. */
  priceCompareLabel: string;
  priceOfferLabel: string;

  viewCount: number;
  orderCount: number;
  createdAt: string;
  updatedAt: string;
}

/*
 * Client for the Landing Pages admin module. Deliberately NOT wired into the
 * big AdminState diff-sync engine in lib/admin.tsx — that engine syncs a
 * whole-state diff on every change, and campaign pages want explicit
 * save/publish/duplicate actions with their own optimistic reload.
 *
 * Talks to the real backend (`/admin/api/landing-pages`, proxied by
 * next.config.ts). The former local mock under app/admin/api/landing-pages
 * and its in-memory store are gone — with them removed, the rewrite handles
 * these paths, so the clean REST shape below works as documented.
 */


export const listLandingPages = () => unwrap(api.admin.api["landing-pages"].get(), "GET /admin/api/landing-pages");

/** The campaign content keys — optional on a draft, see below. */
type CampaignKey =
  | "hotlineLabel" | "hotlineNumber" | "headerCtaLabel"
  | "trustBadges" | "subheadline" | "discountBadge" | "heroCtaNote"
  | "brandStripTitle" | "brandLogos"
  | "videoTitle" | "videoUrl"
  | "featuresTitle" | "features"
  | "specTitle" | "specMeta" | "specs"
  | "bundlesTitle" | "bundlesSubtitle" | "bundleUnitLabel" | "bundleMaxQty"
  | "qcTitle" | "qcBody" | "qcPoints" | "qcImageHint"
  | "countdownTitle" | "countdownNote" | "countdownEndsAt"
  | "countdownCtaLabel" | "countdownAssurance"
  | "testimonialsTitle" | "testimonials"
  | "formTitle" | "formIntro" | "formLabels"
  | "footerTagline" | "footerAbout" | "footerLines"
  | "colorHeroBg" | "colorHeroText" | "colorBandBg" | "colorBandText"
  | "colorTintBg" | "colorPageBg" | "colorPageText" | "colorAccent"
  | "colorHighlight" | "colorCtaBg" | "colorCtaText"
  | "productRowIds" | "priceCompareLabel" | "priceOfferLabel";

/** The theme keys, in one place so the editor and the save boundary agree. */
export const COLOR_KEYS = [
  "colorHeroBg", "colorHeroText",
  "colorBandBg", "colorBandText",
  "colorTintBg", "colorPageBg", "colorPageText",
  "colorAccent", "colorHighlight",
  "colorCtaBg", "colorCtaText",
] as const;

export type ColorKey = (typeof COLOR_KEYS)[number];

/**
 * The writable subset — everything the server resolves or owns is stripped.
 *
 * Campaign content is optional rather than required, mirroring the server DTO:
 * "New landing page" creates a page in one click and the sections are written
 * afterwards, so a create body that carried 37 empty strings would be noise.
 */
export type LandingPageDraft = Omit<
  LandingPage,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "viewCount"
  | "orderCount"
  | "productName"
  | "productSlug"
  | "productVisible"
  | "productSellingPrice"
  | CampaignKey
> &
  Partial<Pick<LandingPage, CampaignKey>>;

/**
 * Round the campaign's three numeric fields to what the DTO takes.
 *
 * Same boundary rule as `productBody` in admin-api.ts: the editor's number
 * inputs hold what is being typed, including a partial decimal, and every one
 * of these is an integer server-side. A fractional offer price answered 422
 * with a schema dump, on a screen whose only other option was to lose the copy
 * already written into the form.
 */
function campaignNumbers<T extends Partial<LandingPageDraft>>(body: T): T {
  const out = { ...body };
  for (const key of ["offerPrice", "compareAtPrice", "bundleMaxQty"] as const) {
    if (typeof out[key] === "number") out[key] = whole(out[key]) as T[typeof key];
  }
  // The one number with an upper bound. Clamping is safe where truncating a
  // list is not: there is no wording to lose, and "10 rows" is plainly what
  // was meant by "25 rows" once the server has refused it anyway.
  if (typeof out.bundleMaxQty === "number") {
    out.bundleMaxQty = Math.min(
      BUNDLE_MAX_ROWS,
      Math.max(1, out.bundleMaxQty),
    ) as T["bundleMaxQty"];
  }
  return out;
}

/**
 * The server's list caps, mirrored.
 *
 * Every one of these answers 422 with a schema dump naming nothing a person
 * would recognise — on a screen holding a page of unsaved ad copy. The editor
 * checks them first so the message can name the section and the number, and
 * so the copy stays on screen to be fixed.
 *
 * Truncating instead would be worse: the lines past the cap are wording
 * someone wrote, and dropping them silently is indistinguishable from a bug.
 *
 * Keep in step with backend/src/dtos/landing-pages.dto.ts.
 */
export const CAMPAIGN_LIMITS: { key: keyof LandingPage; label: string; max: number }[] = [
  { key: "trustBadges", label: "Trust badges", max: 6 },
  { key: "brandLogos", label: "Brand names", max: 10 },
  { key: "features", label: "Features", max: 12 },
  { key: "specs", label: "Specs", max: 10 },
  { key: "qcPoints", label: "Quality points", max: 8 },
  { key: "testimonials", label: "Testimonials", max: 12 },
  { key: "footerLines", label: "Footer contact lines", max: 8 },
  { key: "productRowIds", label: "Product row", max: 12 },
  { key: "benefitBullets", label: "Benefit bullets", max: 10 },
];

export const BUNDLE_MAX_ROWS = 10;

/**
 * What the server would reject, said in words the person typing can act on.
 *
 * Returns one line per problem, empty when the body will be accepted. It only
 * covers the rules the editor can actually violate — a slug collision is the
 * server's to detect, and 409s with a sentence of its own.
 */
export function campaignProblems(body: Partial<LandingPageDraft>): string[] {
  const problems: string[] = [];

  for (const { key, label, max } of CAMPAIGN_LIMITS) {
    const value = body[key as keyof typeof body];
    if (Array.isArray(value) && value.length > max) {
      problems.push(`${label}: ${value.length} entered, at most ${max} allowed.`);
    }
  }

  if (typeof body.title === "string" && body.title.trim().length < 2) {
    problems.push("Internal title needs at least 2 characters.");
  }
  if (typeof body.slug === "string" && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(body.slug)) {
    problems.push("Link slug: lowercase letters, numbers and single hyphens only.");
  }
  if (typeof body.gtmId === "string" && !/^$|^GTM-[A-Z0-9]+$/.test(body.gtmId)) {
    problems.push("GTM container id must look like GTM-XXXXXXX, or be empty.");
  }

  return problems;
}

/**
 * Make every colour something the DTO will accept, or send nothing for it.
 *
 * The server takes `#RGB` or `#RRGGBB` and 422s anything else. The colour
 * editor only ever commits a valid value, so this is a backstop for the paths
 * that don't go through it — a duplicated page, a field pasted into, a future
 * caller. It expands the short form rather than passing it on, so what comes
 * back from the server is the same string in every row.
 *
 * An unparseable value is dropped rather than sent: losing one colour on save
 * beats a 422 that discards the campaign copy typed alongside it. The editor
 * is what stops that being silent — it won't let an invalid value get here.
 */
function campaignColors<T extends Partial<LandingPageDraft>>(body: T): T {
  const out = { ...body };
  for (const key of COLOR_KEYS) {
    const raw = out[key];
    if (typeof raw !== "string") continue;
    const hex = raw.trim().replace(/^#?/, "#");
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      out[key] = hex.toUpperCase() as T[ColorKey];
    } else if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
      const [r, g, b] = hex.slice(1);
      out[key] = `#${r}${r}${g}${g}${b}${b}`.toUpperCase() as T[ColorKey];
    } else {
      delete out[key];
    }
  }
  return out;
}

const campaignBody = <T extends Partial<LandingPageDraft>>(body: T): T =>
  campaignColors(campaignNumbers(body));

export const createLandingPage = (draft: LandingPageDraft) =>
  unwrap(api.admin.api["landing-pages"].post(campaignBody(draft)), "POST /admin/api/landing-pages");


export const patchLandingPage = (id: string, patch: Partial<LandingPageDraft>) =>
  unwrap(
    api.admin.api["landing-pages"]({ id }).patch(campaignBody(patch)),
    "PATCH /admin/api/landing-pages/:id",
  );

export const deleteLandingPage = (id: string) => unwrap(api.admin.api["landing-pages"]({ id }).delete(), "DELETE /admin/api/landing-pages/:id");

export const publishLandingPage = (id: string) =>
  unwrap(api.admin.api["landing-pages"]({ id }).publish.post(), "POST /admin/api/landing-pages/:id/publish");

export const unpublishLandingPage = (id: string) =>
  unwrap(api.admin.api["landing-pages"]({ id }).unpublish.post(), "POST /admin/api/landing-pages/:id/unpublish");

export const duplicateLandingPage = (id: string) =>
  unwrap(api.admin.api["landing-pages"]({ id }).duplicate.post(), "POST /admin/api/landing-pages/:id/duplicate");

export function useLandingPages() {
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // No synchronous setState in the effect body itself (only inside the
  // .then/.catch below) — fetchList is safe to call directly from the
  // mount effect. `reload` (used from event handlers, e.g. after
  // save/publish/delete) is a separate function that's fine to set state
  // synchronously in, since it's never called from inside an effect.
  const fetchList = useCallback((signal?: AbortSignal) => {
    return listLandingPages()
      .then((data) => {
        if (signal?.aborted) return;
        setPages(data);
        setError(false);
      })
      .catch(() => {
        if (!signal?.aborted) setError(true);
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchList(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchList]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    await fetchList();
  }, [fetchList]);

  return { pages, loading, error, reload };
}
