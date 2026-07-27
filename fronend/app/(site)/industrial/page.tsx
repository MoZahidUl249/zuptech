import type { Metadata } from "next";
import Link from "next/link";
import { Zap, SlidersHorizontal, Share2, Shield, BadgeCheck, ArrowRight } from "lucide-react";
import { BrandHero } from "@/components/marketing/brand-hero";
import { IndustrialConsultationForm } from "@/components/marketing/industrial-consultation-form";
import {
  industrialServices,
  gridSolutionHighlights,
  operationalStandards,
  type IndustrialIcon,
} from "@/lib/industrial";
import { site, jsonLd } from "@/lib/site";
import {
  getIndustrialServices,
  getPageHeroes,
  getSiteConfig,
  type ServiceCard,
} from "@/lib/api";
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

const icons: Record<IndustrialIcon, typeof Zap> = {
  zap: Zap,
  sliders: SlidersHorizontal,
  network: Share2,
  shield: Shield,
};

/** One card, however it arrived: from the admin-managed API or the bundled
 *  static list. `num` is positional, so it stays correct after a reorder. */
interface IndustrialCard {
  id: string;
  num: string;
  title: string;
  description: string;
  tags: string[];
  image?: string;
  icon?: IndustrialIcon;
}

function toCards(live: ServiceCard[]): IndustrialCard[] {
  if (live.length > 0) {
    return live.map((s, i) => ({
      id: s.id,
      num: String(i + 1).padStart(2, "0"),
      title: s.name,
      description: s.dsc,
      tags: s.features,
      image: s.image || undefined,
    }));
  }
  return industrialServices.map((s) => ({
    id: s.id,
    num: s.num,
    title: s.title,
    description: s.description,
    tags: s.tags,
    icon: s.icon,
  }));
}

export default async function IndustrialPage() {
  // Server component: reading copy here puts it in the SSR HTML, so it's
  // SEO-visible and there's no post-hydration text swap.
  const [live, config, heroes] = await Promise.all([
    getIndustrialServices(),
    getSiteConfig(),
    getPageHeroes(),
  ]);
  const cards = toCards(live);
  const copy = resolveCopy(config?.copy);

  // Built from the resolved list so structured data matches what renders.
  const industrialJsonLd = {
    "@context": "https://schema.org",
    "@graph": cards.map((c) => ({
      "@type": "Service",
      "@id": `${site.url}/industrial#${c.id}`,
      name: c.title,
      description: c.description,
      provider: { "@id": `${site.url}/#organization` },
      areaServed: { "@type": "Country", name: "Bangladesh" },
      serviceType: c.tags.join(", "),
    })),
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(industrialJsonLd) }}
      />

      <BrandHero
        eyebrow={copy.industrialHeroEyebrow}
        headline={copy.industrialHeroHeadline}
        subhead={copy.industrialHeroSubhead}
        primaryCta={{ label: "Our Services", href: "#core-services" }}
        secondaryCta={{ label: "Technical Specs", href: "#operational-standards" }}
        hero={heroes.industrial}
      />

      {/* HIGH-VOLTAGE GRID SOLUTIONS */}
      <section className="px-5 py-16" aria-labelledby="grid-solutions-heading">
        <div className="mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="mb-3 block text-xs font-bold uppercase tracking-[0.14em] text-zup-orange">
              The grid authority
            </span>
            <h2
              id="grid-solutions-heading"
              className="mb-4 text-[clamp(24px,3.6vw,34px)] font-bold tracking-[-0.02em]"
            >
              High-Voltage Grid Solutions
            </h2>
            <p className="mb-7 max-w-[520px] text-[15px] leading-relaxed text-zup-gray">
              ZUP TECH provides comprehensive engineering, procurement and construction
              services for complex grid interconnections. Our solutions ensure stability
              and maximum uptime for regional power networks.
            </p>
            <div className="flex flex-col gap-5">
              {gridSolutionHighlights.map((item) => {
                const Icon = icons[item.icon];
                return (
                  <div key={item.id} className="flex items-start gap-3.5">
                    <Icon className="mt-0.5 h-5 w-5 flex-none text-zup-orange" strokeWidth={2} aria-hidden />
                    <div>
                      <h3 className="mb-0.5 text-[15px] font-bold">{item.title}</h3>
                      <p className="text-[13.5px] leading-relaxed text-zup-gray">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div
            className="flex min-h-[280px] items-center justify-center overflow-hidden rounded-2xl bg-[repeating-linear-gradient(-45deg,#EFF1F4_0_14px,#F6F7F9_14px_28px)]"
            role="img"
            aria-label="Industrial facility interior — conduits, transformers, steel"
          >
            <span className="rounded-lg bg-white/85 px-3 py-1.5 text-center font-mono text-[11px] text-zup-faint">
              Industrial facility interior — conduits, transformers, steel
            </span>
          </div>
        </div>
      </section>

      {/* CORE INFRASTRUCTURE SERVICES */}
      <section
        id="core-services"
        className="scroll-mt-20 bg-zup-bg px-5 py-16"
        aria-labelledby="core-services-heading"
      >
        <div className="mx-auto max-w-[1120px]">
          <div className="mx-auto mb-9 max-w-[560px] text-center">
            <h2
              id="core-services-heading"
              className="mb-3 text-[clamp(26px,4vw,34px)] font-bold tracking-[-0.025em]"
            >
              Core Infrastructure Services
            </h2>
            <p className="text-[15.5px] leading-relaxed text-zup-gray">
              Providing the technical backbone for sustainable and efficient energy
              distribution.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {cards.map((service) => {
              const Icon = service.icon ? icons[service.icon] : null;
              return (
                <article
                  key={service.id}
                  className="rounded-[22px] border border-zup-body/6 bg-white px-6 py-7 sm:px-8 sm:py-8"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    {service.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={service.image}
                        alt=""
                        className="h-12 w-12 rounded-xl object-cover"
                      />
                    ) : Icon ? (
                      <Icon className="h-7 w-7 text-zup-blue" strokeWidth={2} aria-hidden />
                    ) : (
                      <span className="h-7 w-7" aria-hidden />
                    )}
                    <span className="rounded-md bg-zup-body/5 px-3 py-1 font-mono text-xs font-bold text-zup-soft">
                      {service.num}
                    </span>
                  </div>
                  <h3 className="mb-2 text-xl font-bold tracking-[-0.015em]">
                    {service.title}
                  </h3>
                  <p className="mb-4 max-w-[640px] text-[14.5px] leading-relaxed text-zup-gray">
                    {service.description}
                  </p>
                  <ul className="flex flex-wrap gap-[7px]">
                    {service.tags.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full bg-zup-blue/6 px-[13px] py-1.5 text-[12px] font-bold uppercase tracking-[0.02em] text-zup-blue"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
            <div className="flex flex-col justify-center gap-4 rounded-[22px] bg-zup-ink px-6 py-7 sm:px-8 sm:py-8">
              <h3 className="text-xl font-bold tracking-[-0.015em] text-zup-bg">
                Need Custom Infrastructure?
              </h3>
              <p className="text-[14.5px] leading-relaxed text-[#A7ACB5]">
                Connect with our lead systems engineer for a technical consultation.
              </p>
              <Link
                href="/contact?intent=quote"
                className="inline-flex w-fit items-center gap-2 rounded-full bg-zup-orange px-6 py-3 text-[13px] font-bold uppercase tracking-[0.04em] text-white transition-colors hover:bg-zup-orange-dark"
              >
                Get Technical Audit
                <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* OPERATIONAL STANDARDS */}
      <section
        id="operational-standards"
        className="scroll-mt-20 bg-zup-ink px-5 py-16"
        aria-labelledby="operational-standards-heading"
      >
        <div className="mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div>
            <h2
              id="operational-standards-heading"
              className="mb-4 text-[clamp(24px,3.6vw,34px)] font-bold tracking-[-0.02em] text-zup-bg"
            >
              Operational Standards
            </h2>
            <p className="mb-5 max-w-[440px] text-[14.5px] leading-relaxed text-[#A7ACB5]">
              Our deployments are measured against the most rigorous uptime and safety
              KPIs in the energy sector. Reliability is not a goal; it&apos;s our baseline.
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-zup-orange/50 px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-zup-orange">
              <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              ISO 9001:2015 Certified
            </span>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/3 px-6 sm:px-7">
            {operationalStandards.map((row, i) => (
              <div
                key={row.parameter}
                className={`flex items-center justify-between gap-4 py-4 text-[13px] font-semibold uppercase tracking-[0.03em] ${
                  i > 0 ? "border-t border-white/8" : ""
                }`}
              >
                <span className="text-[#8A9099]">{row.parameter}</span>
                <span className="text-right text-zup-gray">{row.standard}</span>
                <span className="text-right text-zup-orange">{row.field}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Project portfolio intentionally omitted: the previous section shipped
          invented case studies (fictional client and project names). Re-add it
          once real, approved project references are available. */}

      <div className="px-5 py-16">
        {/* Built from the same resolved cards the page renders, so the
            dropdown never offers a service that isn't shown above it. */}
        <IndustrialConsultationForm
          options={cards.map((c) => ({ id: c.id, title: c.title }))}
        />
      </div>
      <div className="h-8" />
    </main>
  );
}
