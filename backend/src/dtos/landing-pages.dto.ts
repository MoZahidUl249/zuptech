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

export const createLandingPageDto = t.Object(landingPageFields);
/** Every field optional — the admin saves one edited field at a time. */
export const updateLandingPageDto = t.Partial(t.Object(landingPageFields));

export const listLandingPagesQueryDto = t.Object({
  published: t.Optional(t.Boolean()),
});

export type CreateLandingPageDto = typeof createLandingPageDto.static;
export type UpdateLandingPageDto = typeof updateLandingPageDto.static;
export type ListLandingPagesQueryDto = typeof listLandingPagesQueryDto.static;
