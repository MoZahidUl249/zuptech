import { t } from "elysia";
import { slugDto } from "./common";

/**
 * Landing pages: unlisted single-product campaign pages for ad traffic
 * (`/lp/:slug`), see ../../../fronend/LANDING-PAGES.md.
 *
 * `offerPrice`/`compareAtPrice` are display copy, not money the server acts
 * on — checkout never reads either, so a number typed beside a headline
 * cannot move a total.
 *
 * A campaign CAN charge its own price, through `tiers` below: absolute
 * per-unit prices in a constrained child table that `priceCart()` reads
 * server-side. Copy and money stay different things, held in different
 * places.
 */
/**
 * A hex colour, 3- or 6-digit.
 *
 * The pattern is load-bearing, not tidiness: these values are interpolated
 * straight into `style` on the rendered campaign page, so this is the boundary
 * that decides what may reach it. The renderer trusts whatever gets through.
 *
 * Optional so a PATCH changing one colour need not resend the other ten.
 */
const hexColor = t.Optional(t.String({ pattern: "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$" }));

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

  /*
   * Theme colours, one per role.
   *
   * Pattern-validated as 3- or 6-digit hex. That matters more than it looks:
   * these are interpolated straight into `style` on the rendered page, so an
   * unvalidated string is a place to put things that are not colours. The
   * pattern is the boundary — the renderer trusts what it is handed.
   *
   * Optional so a PATCH of one colour does not require sending all eleven.
   */
  colorHeroBg: hexColor,
  colorHeroText: hexColor,
  colorBandBg: hexColor,
  colorBandText: hexColor,
  colorTintBg: hexColor,
  colorPageBg: hexColor,
  colorPageText: hexColor,
  colorAccent: hexColor,
  colorHighlight: hexColor,
  colorCtaBg: hexColor,
  colorCtaText: hexColor,

  /** Ordered product ids for the row above the page. Empty hides it. */
  priceCompareLabel: t.Optional(t.String({ maxLength: 80 })),
  priceOfferLabel: t.Optional(t.String({ maxLength: 80 })),
  productRowIds: t.Optional(t.Array(t.String({ minLength: 1, maxLength: 50 }), { maxItems: 12 })),

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
   * Nothing in `campaignFields` is money. The bundle block stores only
   * wording; the prices it shows come from the campaign's own `tiers` when it
   * has any and from the product's quantity offers when it does not — which
   * is why `tiers` is validated outside this object rather than in it. */
/**
 * Media caps.
 *
 * Declared here rather than in the route file — unlike MAX_PRODUCT_PHOTOS,
 * which lives beside its handler and can drift from the schema's own maxItems,
 * the guard and the validator below read the same constant.
 */
export const MAX_CAMPAIGN_GALLERY = 12;
export const MAX_CAMPAIGN_QC_IMAGES = 8;

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

  /* In the hero, in place of the pack shot. Blank keeps the photo. Same URL
     rule as `videoUrl` below — the renderer parses it and shows nothing when
     it is unusable, rather than embedding something that 404s. */
  heroVideoUrl: t.String({ maxLength: 500, pattern: "^$|^https?://\\S+$" }),
  videoTitle: t.String({ maxLength: 200 }),
  videoUrl: t.String({ maxLength: 500, pattern: "^$|^https?://\\S+$" }),

  /* The "what's in the box" gallery — ordered, mixed photos and clips.

     `url` carries the same pattern as `videoUrl`: the renderer feeds it
     straight to next/image and to <video src>, so this is the boundary that
     decides what may reach them. `kind` is a closed union because the renderer
     branches on it — an unrecognised value would put a photo in a <video>. The
     upload route sets it from the sniffed bytes; a client can only ever
     restate what the server already decided. */
  galleryItems: t.Array(
    t.Object({
      url: t.String({ maxLength: 500, pattern: "^https?://\\S+$" }),
      kind: t.Union([t.Literal("image"), t.Literal("video")]),
      alt: t.String({ maxLength: 200 }),
    }),
    { maxItems: MAX_CAMPAIGN_GALLERY },
  ),

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
  /* Ordered quality-block photos. Homogeneous, so a plain URL array. */
  qcImages: t.Array(
    t.String({ maxLength: 500, pattern: "^https?://\\S+$" }),
    { maxItems: MAX_CAMPAIGN_QC_IMAGES },
  ),
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
/**
 * The campaign's own bulk ladder: "buy N+, pay ৳P each".
 *
 * `unitPrice` is an ABSOLUTE price per unit, not taka off — see the model
 * comment on LandingPageTier. `minQty` starts at 1, unlike the product's
 * ladders which start at 2: a campaign may legitimately price a single unit
 * differently from the shop, which is the whole point of an ad price.
 *
 * Sits OUTSIDE `campaignFields` deliberately. Everything in there is copy;
 * this is the one thing on a landing page that moves money, and it is written
 * through its own replace-all path rather than sprayed into `data`.
 */
export const landingPageTierDto = t.Object({
  minQty: t.Integer({ minimum: 1, maximum: 99 }),
  unitPrice: t.Integer({ minimum: 0 }),
});

/** Sending a ladder replaces the whole thing; omitting it leaves it alone —
 *  the same contract as the product's two ladders. */
const tiersField = t.Optional(t.Array(landingPageTierDto, { maxItems: 10 }));

export const createLandingPageDto = t.Object({
  ...landingPageFields,
  ...Object.fromEntries(
    Object.entries(campaignFields).map(([k, v]) => [k, t.Optional(v)]),
  ),
  tiers: tiersField,
});
export const updateLandingPageDto = t.Composite([
  t.Partial(t.Object({ ...landingPageFields, ...campaignFields })),
  // Outside the Partial for the same reason the product ladders are: "sent"
  // and "absent" must stay distinguishable, or replace-all cannot tell a
  // deliberate clearing from an untouched field.
  t.Object({ tiers: tiersField }),
]);

export const listLandingPagesQueryDto = t.Object({
  published: t.Optional(t.Boolean()),
});

export type CreateLandingPageDto = typeof createLandingPageDto.static;
export type UpdateLandingPageDto = typeof updateLandingPageDto.static;
export type ListLandingPagesQueryDto = typeof listLandingPagesQueryDto.static;

/**
 * One gallery slide — a photo OR a clip, so no `type` constraint here.
 *
 * See the note on `uploadSlideImageDto` in content.dto.ts: a t.Union of two
 * t.File stops Elysia recognising the field as a file at all. Nothing is lost
 * by leaving it off — `uploadMedia` runs `classifyAndValidate`, which
 * allow-lists the MIME types AND sniffs the magic bytes, and it is that call
 * which decides the stored `kind`.
 */
export const uploadLandingGalleryDto = t.Object({
  file: t.File({ maxSize: "60m" }),
});
export type UploadLandingGalleryDto = typeof uploadLandingGalleryDto.static;

/** One quality photo. Same 8 MB image ceiling as every other picture upload. */
export const uploadLandingQcImageDto = t.Object({
  file: t.File({ type: "image", maxSize: "8m" }),
});
export type UploadLandingQcImageDto = typeof uploadLandingQcImageDto.static;
