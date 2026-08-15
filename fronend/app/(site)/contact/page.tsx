import type { Metadata } from "next";
import { site, jsonLd } from "@/lib/site";
import { ContactOffice } from "@/components/contact-office";
import { TeamStrip } from "@/components/team-strip";
import { getSiteConfig, getTeam } from "@/lib/api";
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
  const [config, team] = await Promise.all([getSiteConfig(), getTeam()]);
  const copy = resolveCopy(config?.copy);

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(contactJsonLd) }}
      />

      {/*
        The message form, the Sales desk / WhatsApp / Email cards and the
        visible heading were removed on 2026-08-13 at the client's request.

        The heading survives as a visually-hidden <h1>. A page still needs
        exactly one — for search engines, and so a screen reader announces
        something on arrival other than the first thing it happens to find —
        and the same treatment is already used on the home page for the same
        reason. It renders nothing on screen.

        NOTE: with the form gone there is no route from the site into
        ContactMessage. The backend endpoint and the admin's Messages screen
        still exist and will simply never receive anything new.
      */}
      <h1 className="sr-only">{copy.contactHeading}</h1>

      <section className="px-5 pt-10">
        <div className="mx-auto max-w-[1120px]">
          <ContactOffice />
        </div>
      </section>

      <TeamStrip members={team} />

      {/*
        The old leadership roster is deliberately not restored. The six people in
        lib/team.ts were invented — names, roles and biographies — and
        publishing fabricated staff for a real business is worse than publishing
        none. <TeamStrip> above is the replacement: admin-entered rows, empty
        until the client fills in real, consented details.
      */}

      <div className="h-20" />
    </main>
  );
}
