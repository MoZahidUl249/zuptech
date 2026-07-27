import { t } from "elysia";

/** Whole-document PUT — the panel edits the full slide set and saves it back. */
export const updateSlidesDto = t.Object({
  slides: t.Array(
    t.Object({
      // A media-storage URL. The old admin panel inlined base64 data-URLs here
      // (hence the former 2,000,000 cap) — uploads now go through
      // POST /admin/api/slides/image, so this only ever holds a URL.
      image: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
      cta: t.String({ maxLength: 80 }),
      href: t.String({ maxLength: 300 }),
      active: t.Boolean(),
      fit: t.Union([t.Literal("cover"), t.Literal("contain")]),
      bg: t.String({ maxLength: 300 }),
    }),
    { maxItems: 10 },
  ),
});

/*
 * Site copy. Partial so the panel can save one section without resending every
 * field, and so an older client that only knows the original four keeps
 * working. Blank strings are meaningful: they mean "fall back to the
 * frontend's built-in default" (see resolveCopy in lib/admin-bridge.ts).
 */
const eyebrow = t.String({ maxLength: 60 });
const heading = t.String({ maxLength: 120 });
const body = t.String({ maxLength: 400 });

export const updateCopyDto = t.Partial(
  t.Object({
    featuredHeading: heading,
    servicesHeading: heading,
    servicesSubtitle: body,
    footerDescription: body,

    // Home page
    homeHeroEyebrow: eyebrow,
    homeHeroHeadline: heading,
    homeHeroSubhead: body,
    homeIndustrialEyebrow: eyebrow,
    homeIndustrialHeading: heading,
    homeCapabilitiesEyebrow: eyebrow,
    homeCapabilitiesHeading: heading,
    homeCtaHeading: heading,
    homeCtaSubtext: body,
    homeCtaButton: t.String({ maxLength: 40 }),

    // Industrial page
    industrialHeroEyebrow: eyebrow,
    industrialHeroHeadline: heading,
    industrialHeroSubhead: body,
    industrialGridHeading: heading,
    industrialGridBody: body,
    industrialServicesHeading: heading,
    industrialServicesSubtitle: body,
    industrialStandardsHeading: heading,
    industrialStandardsBody: body,

    // Contact page
    contactHeading: heading,
    contactFormHeading: heading,
    contactOfficeHeading: heading,
    contactTeamHeading: heading,
    contactServiceLine: t.String({ maxLength: 40 }),
    contactTendersEmail: t.String({ maxLength: 120 }),
  }),
);

export const updateContactDto = t.Object({
  phone: t.String({ maxLength: 20 }),
  phoneDisplay: t.String({ maxLength: 30 }),
  hotline: t.String({ maxLength: 30 }),
  email: t.String({ maxLength: 200 }),
  whatsapp: t.String({ maxLength: 20, pattern: "^[0-9]*$" }),
  street: t.String({ maxLength: 200 }),
  city: t.String({ maxLength: 80 }),
  postalCode: t.String({ maxLength: 20 }),
  hours: t.String({ maxLength: 80 }),
});

export const updateIntegrationsDto = t.Object({
  gtmId: t.String({ maxLength: 20 }),
  gtmEnabled: t.Boolean(),
});

/**
 * Slide rows are recreated wholesale on every `PUT /admin/api/slides` (no
 * stable id to attach an upload to), so image upload is a standalone step:
 * upload first, then paste the returned URL into the slide's `image` field.
 */
export const uploadSlideImageDto = t.Object({
  file: t.File({ type: "image", maxSize: "8m" }),
});

export type UpdateSlidesDto = typeof updateSlidesDto.static;
export type UpdateCopyDto = typeof updateCopyDto.static;
export type UpdateContactDto = typeof updateContactDto.static;
export type UpdateIntegrationsDto = typeof updateIntegrationsDto.static;
export type UploadSlideImageDto = typeof uploadSlideImageDto.static;
