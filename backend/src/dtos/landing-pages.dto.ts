import { t } from "elysia";
import { slugDto } from "./common";

/**
 * Landing pages: unlisted single-product campaign pages for ad traffic
 * (`/lp/:slug`), see ../../../fronend/LANDING-PAGES.md.
 *
 * `offerPrice`/`compareAtPrice` are display copy, not money the server acts
 * on — checkout still reprices from the catalog through priceCart(), so a
 * campaign can advertise a number without being able to move it.
 */
const landingPageFields = {
  title: t.String({ minLength: 2, maxLength: 200 }),
  // "" = fall back to the product name.
  headline: t.String({ maxLength: 200 }),
  slug: slugDto,
  productId: t.String({ minLength: 1, maxLength: 50 }),
  offerPrice: t.Integer({ minimum: 0 }),
  compareAtPrice: t.Integer({ minimum: 0 }),
  ribbonText: t.String({ maxLength: 200 }),
  buttonLabel: t.String({ maxLength: 60 }),
  footerNote: t.String({ maxLength: 300 }),
  benefitBullets: t.Array(t.String({ maxLength: 300 }), { maxItems: 10 }),
  imageHint: t.String({ maxLength: 200 }),
  // Its own container so campaign spend is tracked apart from the main site.
  // "" clears it; otherwise it must look like a real GTM id.
  gtmId: t.String({ maxLength: 40, pattern: "^$|^GTM-[A-Z0-9]+$" }),
  published: t.Boolean(),
};

/* ===== Campaign page content =====
   *
   * Every visitor-facing string on /lp/:slug, so a campaign is written from
   * the admin in whatever language it runs in. Lengths are generous because
   * Bangla in UTF-8 costs roughly three bytes a character and these are
   * character limits — a 60-character English button label is a third of the
   * same sentence in Bangla.
   *
   * Nothing here is money. The bundle block stores only wording; every price
   * it shows is derived from the product's quantity offers at render time. */
const campaignFields = {
  hotlineLabel: t.String({ maxLength: 120 }),
  hotlineNumber: t.String({ maxLength: 60 }),
  headerCtaLabel: t.String({ maxLength: 80 }),

  trustBadges: t.Array(t.String({ maxLength: 120 }), { maxItems: 6 }),
  subheadline: t.String({ maxLength: 600 }),
  discountBadge: t.String({ maxLength: 60 }),
  heroCtaNote: t.String({ maxLength: 200 }),

  brandStripTitle: t.String({ maxLength: 160 }),
  brandLogos: t.Array(t.String({ maxLength: 80 }), { maxItems: 10 }),

  videoTitle: t.String({ maxLength: 200 }),
  videoUrl: t.String({ maxLength: 500, pattern: "^$|^https?://\\S+$" }),

  featuresTitle: t.String({ maxLength: 200 }),
  features: t.Array(
    t.Object({
      title: t.String({ maxLength: 160 }),
      body: t.String({ maxLength: 600 }),
    }),
    { maxItems: 12 },
  ),

  specTitle: t.String({ maxLength: 160 }),
  specMeta: t.String({ maxLength: 120 }),
  specs: t.Array(
    t.Object({
      value: t.String({ maxLength: 60 }),
      label: t.String({ maxLength: 120 }),
    }),
    { maxItems: 10 },
  ),

  bundlesTitle: t.String({ maxLength: 200 }),
  bundlesSubtitle: t.String({ maxLength: 300 }),
  bundleUnitLabel: t.String({ maxLength: 40 }),
  bundleMaxQty: t.Integer({ minimum: 1, maximum: 10 }),

  qcTitle: t.String({ maxLength: 200 }),
  qcBody: t.String({ maxLength: 1200 }),
  qcPoints: t.Array(t.String({ maxLength: 300 }), { maxItems: 8 }),
  qcImageHint: t.String({ maxLength: 200 }),

  countdownTitle: t.String({ maxLength: 200 }),
  countdownNote: t.String({ maxLength: 400 }),
  // "" clears the deadline; the copy stays and only the clock disappears.
  countdownEndsAt: t.String({ maxLength: 40 }),
  countdownCtaLabel: t.String({ maxLength: 80 }),
  countdownAssurance: t.String({ maxLength: 300 }),

  testimonialsTitle: t.String({ maxLength: 200 }),
  testimonials: t.Array(
    t.Object({
      quote: t.String({ maxLength: 600 }),
      name: t.String({ maxLength: 120 }),
      location: t.String({ maxLength: 120 }),
    }),
    { maxItems: 12 },
  ),

  formTitle: t.String({ maxLength: 200 }),
  formIntro: t.String({ maxLength: 600 }),
  formLabels: t.Object({
    name: t.String({ maxLength: 80 }),
    phone: t.String({ maxLength: 80 }),
    address: t.String({ maxLength: 80 }),
    packageLabel: t.String({ maxLength: 80 }),
    deliveryLabel: t.String({ maxLength: 80 }),
    totalLabel: t.String({ maxLength: 80 }),
    submit: t.String({ maxLength: 80 }),
    namePlaceholder: t.String({ maxLength: 120 }),
    phonePlaceholder: t.String({ maxLength: 120 }),
    addressPlaceholder: t.String({ maxLength: 200 }),
    successMessage: t.String({ maxLength: 300 }),
  }),

  footerTagline: t.String({ maxLength: 200 }),
  footerAbout: t.String({ maxLength: 600 }),
  footerLines: t.Array(t.String({ maxLength: 200 }), { maxItems: 8 }),
};

/**
 * Create takes the core fields and treats every campaign string as optional,
 * so "New landing page" still makes a page in one click and the sections fill
 * in afterwards. Update is fully partial, because the admin saves one edited
 * field at a time.
 */
export const createLandingPageDto = t.Object({
  ...landingPageFields,
  ...Object.fromEntries(
    Object.entries(campaignFields).map(([k, v]) => [k, t.Optional(v)]),
  ),
});
export const updateLandingPageDto = t.Partial(
  t.Object({ ...landingPageFields, ...campaignFields }),
);

export const listLandingPagesQueryDto = t.Object({
  published: t.Optional(t.Boolean()),
});

export type CreateLandingPageDto = typeof createLandingPageDto.static;
export type UpdateLandingPageDto = typeof updateLandingPageDto.static;
export type ListLandingPagesQueryDto = typeof listLandingPagesQueryDto.static;
