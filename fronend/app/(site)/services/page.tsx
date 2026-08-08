import type { Metadata } from "next";
import { HeroBanner } from "@/components/marketing/hero-banner";
import { ServiceBooking } from "@/components/marketing/service-booking";
import { site, jsonLd } from "@/lib/site";
import { getServices, getSiteConfig } from "@/lib/api";
import { resolveCopy } from "@/lib/site-copy";

/**
 * Rebuild this page from the admin's content at most once a minute.
 *
 * Without it Next prerenders the page ONCE, when the Docker image is built, and
 * bakes whatever the admin happened to contain at that moment into static HTML.
 * Everything on this page comes from the admin — service cards, showcase cards,
 * site copy — so editing any of it changed nothing on the live site until the
 * next deploy rebuilt the image. That is the bug this fixes.
 *
 * ISR rather than `force-dynamic`: this content changes a few times a week, not
 * per request, so regenerating in the background keeps the page as fast as a
 * static one and a minute of staleness costs nothing. Note the two storefront
 * replicas each hold their own cache, so for up to a minute after an edit one
 * may serve the new copy while the other still serves the old.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Services — Substations, Solar EPC, BMS & Electrical Works",
  description:
    "Integrated energy solutions from residential solar to massive-scale industrial grid infrastructure: substation design, smart home converters, building management systems and critical power distribution across Bangladesh.",
  alternates: { canonical: "/services" },
  openGraph: {
    title: "Integrated Energy Solutions | ZUP TECH",
    description:
      "From residential solar to massive-scale industrial grid infrastructure — engineering excellence for the next generation of energy.",
    url: `${site.url}/services`,
  },
};

export default async function ServicesPage() {
  // Server component: the bookable catalogue has to be resolved here because
  // POST /api/leads needs a real Service.id, not a display label.
  // No getPageHeroes(): the hero is the banner carousel alone now, so
  // Admin → Website has nothing else to place on this page.
  const [bookable, config] = await Promise.all([getServices(), getSiteConfig()]);
  const copy = resolveCopy(config?.copy);

  // Built from the live list so structured data only ever describes what the
  // page actually shows.
  const servicesJsonLd = {
    "@context": "https://schema.org",
    "@graph": bookable.map((s) => ({
      "@type": "Service",
      "@id": `${site.url}/services#${s.slug}`,
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
        dangerouslySetInnerHTML={{ __html: jsonLd(servicesJsonLd) }}
      />

      {/* Same hero as the homepage: the admin's banner slides, full-bleed, and
          nothing else. The headline survives as a visually-hidden <h1> so the
          page still has exactly one, for search engines and for a screen
          reader arriving here. */}
      <h1 className="sr-only">{copy.servicesHeroHeadline}</h1>
      <HeroBanner page="services" />

      {/* The page is the catalogue and the form it books through. The
          residential grid, the trust badges and the closing CTA that used to
          sit here were hardcoded in the frontend — nothing an admin could
          change, and nothing that matched the cards on the home page. */}
      <ServiceBooking services={bookable} kind="services" />
    </main>
  );
}
