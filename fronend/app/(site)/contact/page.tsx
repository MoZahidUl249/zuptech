import type { Metadata } from "next";
import { site, jsonLd } from "@/lib/site";
import { ContactForm } from "@/components/contact-form";
import { ContactCards } from "@/components/contact-cards";
import { ContactOffice } from "@/components/contact-office";
import { HeroBackdrop } from "@/components/marketing/hero-backdrop";
import { getPageHeroes, getSiteConfig } from "@/lib/api";
import { resolveCopy } from "@/lib/site-copy";

export const metadata: Metadata = {
  title: "Contact — Call, WhatsApp or Visit Us in Dhaka",
  description: `Talk to ZUP TECH: call ${site.phoneDisplay} (${site.hours}), message us on WhatsApp for the fastest reply, or visit our office in Banani, Dhaka. We respond to most enquiries within minutes.`,
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact ZUP TECH",
    description:
      "Call, WhatsApp or send a message — power solutions & services across Bangladesh.",
    url: `${site.url}/contact`,
  },
};

const contactJsonLd = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contact ZUP TECH",
  url: `${site.url}/contact`,
  about: { "@id": `${site.url}/#organization` },
};

export default async function ContactPage() {
  const [config, heroes] = await Promise.all([getSiteConfig(), getPageHeroes()]);
  const copy = resolveCopy(config?.copy);
  const hero = heroes.contact;

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(contactJsonLd) }}
      />

      {/* Hero band — the same dark headline treatment as /services and
          /industrial, so Contact stops reading like a stray utility page.
          Carries admin-managed art through the "contact" page hero. */}
      <section className="relative overflow-hidden bg-zup-ink px-5 py-16 sm:py-20">
        <HeroBackdrop hero={hero} />
        {hero && hero.mode !== "plain" ? null : (
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:34px_34px]"
            aria-hidden
          />
        )}
        <div className="relative mx-auto max-w-[1120px]">
          <span className="mb-4 inline-block rounded-md border border-zup-orange/50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-zup-orange">
            Get in touch
          </span>
          <h1 className="mb-3 max-w-[720px] text-[clamp(30px,5vw,46px)] font-bold leading-[1.08] tracking-[-0.03em] text-zup-bg">
            {copy.contactHeading}
          </h1>
          <p className="max-w-[540px] text-base leading-relaxed text-[#A7ACB5]">
            Sales, service and technical enquiries — by phone, WhatsApp, email
            or the form below.
          </p>
        </div>
      </section>

      {/* Form beside the channels, rather than one wide card with the form
          crammed into its left half and dead space on the right. The
          commitments strip that used to straddle the hero's lower edge is
          gone, so this section carries the gap the strip's -mt-8 used to eat. */}
      <section className="px-5 pt-12">
        <div className="mx-auto grid max-w-[1120px] grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="rounded-3xl border border-zup-body/8 bg-white px-6 py-7 sm:px-8 sm:py-8">
            <ContactForm heading={copy.contactFormHeading} />
          </div>
          <aside>
            <ContactCards />
          </aside>
        </div>
      </section>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-[1120px]">
          <ContactOffice />
        </div>
      </section>

      {/*
        The leadership roster is deliberately not rendered. The six people in
        lib/team.ts were invented — names, roles and biographies — and
        publishing fabricated staff for a real business is worse than
        publishing none. Enquiries route through the contact form above.
        Restore it (component and data are in git history, removed 2026-07-28)
        once the client supplies real, consented details; SiteConfig still
        carries `contactTeamHeading` for exactly that.
      */}

      <div className="h-20" />
    </main>
  );
}
