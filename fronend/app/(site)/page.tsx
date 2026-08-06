import type { Metadata } from "next";
import { HeroBanner } from "@/components/marketing/hero-banner";
import { FeaturedEquipment } from "@/components/marketing/featured-equipment";
import { site, jsonLd } from "@/lib/site";
import { getServices, getSiteConfig } from "@/lib/api";
import { resolveCopy } from "@/lib/site-copy";
import { ServicesStrip } from "@/components/marketing/services-strip";

export const metadata: Metadata = {
  title: { absolute: "ZUP TECH — Power Solutions & Services in Bangladesh" },
  description:
    "Power your home & industry, simply. ZUP TECH sells engineered power hardware — IPS, solar, stabilizers, transformers — and delivers turnkey energy services from lighting automation to 33 kV substations across Bangladesh.",
  alternates: { canonical: "/" },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${site.url}/#organization`,
  name: site.name,
  url: site.url,
};

export default async function HomePage() {
  // Server component: copy read here lands in the SSR HTML (SEO-visible, no
  // post-hydration swap).
  // No getPageHeroes() here any more: the homepage hero is the banner
  // carousel alone, so Admin → Page pictures has nothing left to place on
  // this page. The other pages still use it.
  const [services, config] = await Promise.all([getServices(), getSiteConfig()]);
  const copy = resolveCopy(config?.copy);

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(orgJsonLd) }}
      />

      {/* HERO — the admin's banner slides, full-bleed, and nothing else.
          The headline is kept as a visually-hidden <h1> rather than dropped:
          a page still needs exactly one, both for search engines and so a
          screen reader announces something other than "Featured promotions"
          on arrival. It renders nothing on screen. */}
      <h1 className="sr-only">{copy.homeHeroHeadline}</h1>
      <HeroBanner />

      <FeaturedEquipment />

      <ServicesStrip services={services} />
    </main>
  );
}
