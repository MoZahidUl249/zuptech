import type { Metadata } from "next";
import { HeroBanner } from "@/components/marketing/hero-banner";
import { ServiceBooking } from "@/components/marketing/service-booking";
import { site, jsonLd } from "@/lib/site";
import { getIndustrialServices, getSiteConfig } from "@/lib/api";
import { resolveCopy } from "@/lib/site-copy";

export const metadata: Metadata = {
  title: "Industrial — Utility-Scale Electrical Infrastructure",
  description:
    "Powering global infrastructure: substation design & commissioning, smart grid & BMS integration, and industrial power distribution across Bangladesh. Book a consultation with our engineering team.",
  alternates: { canonical: "/industrial" },
  openGraph: {
    title: "Industrial Infrastructure | ZUP TECH",
    description:
      "Utility-scale electrical systems — substations, smart grid integration and power distribution, engineered end to end.",
    url: `${site.url}/industrial`,
  },
};

export default async function IndustrialPage() {
  // Server component: reading copy here puts it in the SSR HTML, so it's
  // SEO-visible and there's no post-hydration text swap.
  // No getPageHeroes(): the hero is the banner carousel alone now, so
  // Admin → Website has nothing else to place on this page.
  const [services, config] = await Promise.all([getIndustrialServices(), getSiteConfig()]);
  const copy = resolveCopy(config?.copy);

  // Built from the live list so structured data matches what renders. The
  // static fallback catalogue this page used to fall back on is gone: the
  // cards are admin-managed, same as the home page and /services, and an
  // unreachable backend should leave the page honest rather than showing
  // capabilities nobody can book.
  const industrialJsonLd = {
    "@context": "https://schema.org",
    "@graph": services.map((s) => ({
      "@type": "Service",
      "@id": `${site.url}/industrial#${s.slug}`,
      name: s.name,
      description: s.dsc,
      provider: { "@id": `${site.url}/#organization` },
      areaServed: { "@type": "Country", name: "Bangladesh" },
      serviceType: s.features.join(", "),
    })),
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(industrialJsonLd) }}
      />

      {/* Same hero as the homepage: the admin's banner slides, full-bleed, and
          nothing else. The headline survives as a visually-hidden <h1> so the
          page still has exactly one, for search engines and for a screen
          reader arriving here. */}
      <h1 className="sr-only">{copy.industrialHeroHeadline}</h1>
      <HeroBanner />

      {/* Same shape as /services — capability cards, then the enquiry form.
          The grid-solutions split, the bespoke numbered cards and the
          operational-standards table that used to fill this page were all
          hardcoded, so none of it could be kept current from the admin. */}
      <ServiceBooking services={services} kind="industrial" />
    </main>
  );
}
