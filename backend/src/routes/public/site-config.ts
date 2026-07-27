import { Elysia } from "elysia";
import { prisma } from "../../lib/db";
import { GTM_ID_RE } from "../../lib/rules";
import { toSlide } from "../../lib/serialize";

/**
 * One payload for the storefront bridge (replaces the five hooks in
 * lib/admin-bridge.ts): featured list, hero slides, contact, copy, GTM and
 * the checkout payment options. NEVER include gateway keys or secrets here —
 * this endpoint is public. Delivery/installation pricing now lives in the
 * location tree — see GET /api/locations, not this endpoint.
 */
export const siteConfig = new Elysia({ name: "routes/public/site-config", detail: { tags: ["Storefront"] } }).get(
  "/api/site-config",
  async () => {
    const [config, slides, payments] = await Promise.all([
      prisma.siteConfig.findUniqueOrThrow({ where: { id: 1 } }),
      prisma.heroSlide.findMany({ orderBy: { sort: "asc" } }),
      prisma.paymentMethod.findMany({ where: { enabled: true }, orderBy: { sort: "asc" } }),
    ]);

    return {
      featuredIds: config.featuredIds,
      // Only active slides with an image render (§4.9); zero → UI defaults.
      slides: slides.filter((s) => s.active && s.image).map(toSlide),
      copy: {
        featuredHeading: config.featuredHeading,
        servicesHeading: config.servicesHeading,
        servicesSubtitle: config.servicesSubtitle,
        footerDescription: config.footerDescription,

        homeHeroEyebrow: config.homeHeroEyebrow,
        homeHeroHeadline: config.homeHeroHeadline,
        homeHeroSubhead: config.homeHeroSubhead,
        homeIndustrialEyebrow: config.homeIndustrialEyebrow,
        homeIndustrialHeading: config.homeIndustrialHeading,
        homeCapabilitiesEyebrow: config.homeCapabilitiesEyebrow,
        homeCapabilitiesHeading: config.homeCapabilitiesHeading,
        homeCtaHeading: config.homeCtaHeading,
        homeCtaSubtext: config.homeCtaSubtext,
        homeCtaButton: config.homeCtaButton,

        industrialHeroEyebrow: config.industrialHeroEyebrow,
        industrialHeroHeadline: config.industrialHeroHeadline,
        industrialHeroSubhead: config.industrialHeroSubhead,
        industrialGridHeading: config.industrialGridHeading,
        industrialGridBody: config.industrialGridBody,
        industrialServicesHeading: config.industrialServicesHeading,
        industrialServicesSubtitle: config.industrialServicesSubtitle,
        industrialStandardsHeading: config.industrialStandardsHeading,
        industrialStandardsBody: config.industrialStandardsBody,

        contactHeading: config.contactHeading,
        contactFormHeading: config.contactFormHeading,
        contactOfficeHeading: config.contactOfficeHeading,
        contactTeamHeading: config.contactTeamHeading,
        contactServiceLine: config.contactServiceLine,
        contactTendersEmail: config.contactTendersEmail,
      },
      contact: {
        phone: config.phone,
        phoneDisplay: config.phoneDisplay,
        hotline: config.hotline,
        email: config.email,
        whatsapp: config.whatsapp,
        street: config.street,
        city: config.city,
        postalCode: config.postalCode,
        hours: config.hours,
      },
      // GTM loads only when enabled AND the id looks like a container id (§4.10).
      gtm: config.gtmEnabled && GTM_ID_RE.test(config.gtmId) ? { id: config.gtmId } : null,
      paymentOptions: payments.map((m) => ({ label: m.name, sub: m.provider })),
    };
  },
);
