import type { Metadata } from "next";
import { Clock, ShieldCheck, Users } from "lucide-react";
import { site, jsonLd } from "@/lib/site";
import { ContactForm } from "@/components/contact-form";
import { ContactCards } from "@/components/contact-cards";
import { ContactOffice } from "@/components/contact-office";
import { TeamGrid } from "@/components/marketing/team-grid";
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

/** Service commitments, stated up front — the questions a B2B buyer has
 *  before they bother filling in a form. */
const commitments = [
  { icon: Clock, title: "Same-day response", note: "Enquiries answered within one working day" },
  {
    icon: Users,
    title: "Talk to an engineer",
    note: "Not a call centre — the people who do the work",
  },
  {
    icon: ShieldCheck,
    title: "Nationwide coverage",
    note: "Installation & service across Bangladesh",
  },
];

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

      {/* Commitments strip, straddling the hero's lower edge so the dark band
          and the page body read as one composition, not two stacked slabs. */}
      <section className="px-5">
        <div className="relative z-10 mx-auto -mt-8 grid max-w-[1120px] grid-cols-1 gap-3 sm:grid-cols-3">
          {commitments.map((c) => (
            <div
              key={c.title}
              className="flex items-start gap-3 rounded-2xl border border-zup-body/8 bg-white px-5 py-4 shadow-[0_2px_10px_rgba(21,24,30,.05)]"
            >
              <c.icon
                className="mt-0.5 h-[18px] w-[18px] flex-none text-zup-orange"
                strokeWidth={2.2}
                aria-hidden
              />
              <div>
                <p className="text-[14px] font-bold tracking-[-0.01em]">{c.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-zup-gray">{c.note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Form beside the channels, rather than one wide card with the form
          crammed into its left half and dead space on the right. */}
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

      <section className="px-5">
        <div className="mx-auto max-w-[1120px]">
          <TeamGrid heading={copy.contactTeamHeading} />
        </div>
      </section>

      <div className="h-20" />
    </main>
  );
}
