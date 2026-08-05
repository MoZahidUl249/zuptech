import type { Metadata } from "next";
import { Zap, LayoutGrid, Sun, BarChart3, BadgeCheck } from "lucide-react";
import { HeroBanner } from "@/components/marketing/hero-banner";
import { FeaturedEquipment } from "@/components/marketing/featured-equipment";
import { CtaBanner } from "@/components/marketing/cta-banner";
import { site, jsonLd } from "@/lib/site";
import { getServices, getSiteConfig } from "@/lib/api";
import { resolveCopy } from "@/lib/site-copy";
import { ServicesStrip } from "@/components/marketing/services-strip";
import { capabilities, homeStats, type CapabilityIconName } from "@/lib/home-content";

export const metadata: Metadata = {
  title: { absolute: "ZUP TECH — Power Solutions & Services in Bangladesh" },
  description:
    "Power your home & industry, simply. ZUP TECH sells engineered power hardware — IPS, solar, stabilizers, transformers — and delivers turnkey energy services from lighting automation to 33 kV substations across Bangladesh.",
  alternates: { canonical: "/" },
};

const capabilityIcons: Record<CapabilityIconName, typeof Zap> = {
  grid: LayoutGrid,
  sun: Sun,
  chart: BarChart3,
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

      <ServicesStrip
        services={services}
        heading={copy.servicesHeading}
        subtitle={copy.servicesSubtitle}
      />

      {/* SPECIALIST CAPABILITIES */}
      <section className="px-5 py-16" aria-labelledby="capabilities-heading">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="mb-3 block text-xs font-bold uppercase tracking-[0.14em] text-zup-orange">
                {copy.homeCapabilitiesEyebrow}
              </span>
              <h2
                id="capabilities-heading"
                className="text-[clamp(24px,3.6vw,34px)] font-bold tracking-[-0.02em]"
              >
                {copy.homeCapabilitiesHeading}
              </h2>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-zup-gray">
              <BadgeCheck className="h-4 w-4 text-zup-blue" strokeWidth={2} aria-hidden />
              ISO 9001:2015 certified
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {capabilities.map((cap) => {
              const Icon = capabilityIcons[cap.icon];
              return (
                <div
                  key={cap.id}
                  className="border-l-4 border-zup-orange bg-white px-6 py-6 shadow-[0_1px_0_rgba(34,38,46,.05)] ring-1 ring-zup-body/6 sm:px-7 sm:py-7"
                >
                  <h3 className="mb-2 flex items-center gap-2.5 text-[17px] font-bold tracking-[-0.01em]">
                    <Icon className="h-5 w-5 text-zup-body" strokeWidth={2} aria-hidden />
                    {cap.title}
                  </h3>
                  <p className="text-[14px] leading-relaxed text-zup-gray">{cap.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="px-5 pb-16" aria-label="Track record">
        <div className="mx-auto grid max-w-[1120px] grid-cols-2 gap-3 sm:grid-cols-4">
          {homeStats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-zup-body/6 bg-white px-4 py-6 text-center"
            >
              <div className="mb-1 text-[28px] font-extrabold tracking-[-0.02em]">
                {stat.value}
              </div>
              <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-zup-soft">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-16">
        <div className="mx-auto max-w-[1120px]">
          <CtaBanner
            heading={copy.homeCtaHeading}
            subtext={copy.homeCtaSubtext}
            buttonLabel={copy.homeCtaButton}
            href="/contact?intent=quote"
          />
        </div>
      </section>
    </main>
  );
}
