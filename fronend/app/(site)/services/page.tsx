import type { Metadata } from "next";
import { BadgeCheck, Headset, ShieldCheck, HeartPulse } from "lucide-react";
import { HeroBanner } from "@/components/marketing/hero-banner";
import { CtaBanner } from "@/components/marketing/cta-banner";
import { ConsultancyForm } from "@/components/marketing/consultancy-form";
import { site, jsonLd } from "@/lib/site";
import { getServices } from "@/lib/api";
import {
  residentialCards,
  trustBadges,
  type TrustIconName,
} from "@/lib/services-content";

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

const trustIcons: Record<TrustIconName, typeof BadgeCheck> = {
  certified: BadgeCheck,
  support: Headset,
  safety: ShieldCheck,
  health: HeartPulse,
};

const servicesJsonLd = {
  "@context": "https://schema.org",
  // Only what the page actually shows — the industrial capability list was
  // removed from the layout, and structured data must not advertise services
  // a visitor can't find on the page it describes.
  "@graph": residentialCards.map((s) => ({
    "@type": "Service",
    "@id": `${site.url}/services#${s.id}`,
    name: s.title,
    description: s.description,
    provider: { "@id": `${site.url}/#organization` },
    areaServed: { "@type": "Country", name: "Bangladesh" },
  })),
};

export default async function ServicesPage() {
  // Server component: the bookable catalogue has to be resolved here because
  // POST /api/leads needs a real Service.id, not a display label.
  // No getPageHeroes(): the hero is the banner carousel alone now, so
  // Admin → Page pictures has nothing left to place on this page.
  const bookable = await getServices();

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
      <h1 className="sr-only">Integrated Energy Solutions</h1>
      <HeroBanner />

      {/* RESIDENTIAL */}
      <section id="residential" className="scroll-mt-16 px-5 py-16" aria-labelledby="residential-heading">
        <div className="mx-auto max-w-[1120px]">
          <h2 id="residential-heading" className="mb-8 text-[clamp(24px,3.6vw,32px)] font-bold tracking-[-0.02em]">
            Residential Power Ecosystems
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {residentialCards.map((card) => (
              <article
                key={card.id}
                className="overflow-hidden rounded-2xl border border-zup-body/6 bg-white"
              >
                <div
                  className="relative flex min-h-[190px] items-center justify-center bg-[repeating-linear-gradient(-45deg,#EFF1F4_0_14px,#F6F7F9_14px_28px)]"
                  role="img"
                  aria-label={card.imageHint}
                >
                  <span className="absolute right-4 top-4 rounded-md bg-zup-ink px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-white">
                    {card.badge}
                  </span>
                  <span className="rounded-lg bg-white/85 px-3 py-1.5 text-center font-mono text-[11px] leading-snug text-zup-faint">
                    {card.imageHint}
                  </span>
                </div>
                <div className="px-6 py-6 sm:px-7 sm:py-7">
                  <h3 className="mb-2 text-[20px] font-bold tracking-[-0.015em]">{card.title}</h3>
                  <p className="mb-4 text-[14px] leading-relaxed text-zup-gray">
                    {card.description}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {card.checklist.map((item) => (
                      <li
                        key={item}
                        className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-[0.02em] text-zup-mid"
                      >
                        <ShieldCheck className="h-4 w-4 flex-none text-zup-orange" strokeWidth={2} aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST BADGES */}
      <section className="px-5 py-16" aria-label="Certifications & standards">
        <div className="mx-auto grid max-w-[1120px] grid-cols-2 gap-6 sm:grid-cols-4">
          {trustBadges.map((badge) => {
            const Icon = trustIcons[badge.icon];
            return (
              <div key={badge.id} className="flex flex-col items-center gap-3 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-zup-body/10 bg-white">
                  <Icon className="h-6 w-6 text-zup-body" strokeWidth={1.8} aria-hidden />
                </span>
                <h3 className="text-[13px] font-bold uppercase tracking-[0.04em]">{badge.title}</h3>
                <p className="text-[12.5px] leading-relaxed text-zup-gray">{badge.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CONSULTANCY FORM */}
      <section className="px-5 pb-16">
        <div className="mx-auto max-w-[1120px]">
          <ConsultancyForm
            options={bookable.map((s) => ({ id: s.id, title: s.name }))}
          />
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-16">
        <div className="mx-auto max-w-[1120px]">
          <CtaBanner
            heading="Ready to Power Your Project?"
            subtext="Schedule a consultation with our senior engineers to discuss your infrastructure requirements and customised energy strategy."
            buttonLabel="Consult Our Engineers"
            href="/contact?intent=quote"
          />
        </div>
      </section>
    </main>
  );
}
