import type { Metadata } from "next";
import { HeroBanner } from "@/components/marketing/hero-banner";
import { FeaturedEquipment } from "@/components/marketing/featured-equipment";
import { site, jsonLd } from "@/lib/site";
import {
  getIndustrialServices,
  getProductsByIds,
  getServices,
  getShowcaseCards,
  getSiteConfig,
} from "@/lib/api";
import { resolveCopy } from "@/lib/site-copy";
import { resolveSlides } from "@/lib/hero-slides";
import { ShowcaseStrip } from "@/components/marketing/showcase-strip";
import { HomeBooking } from "@/components/marketing/home-booking";

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
  // post-hydration swap). Both catalogues are fetched because the booking
  // forms below need real Service.id / IndustrialService.id values — the lead
  // endpoints 404 on anything else.
  // Three lists, three jobs. `showcase` is the front page's own cards and is
  // coupled to nothing. The two catalogues are here only to populate the
  // booking forms' dropdowns — those need real Service / IndustrialService ids
  // or the lead endpoints 404.
  const [showcase, services, industrialServices, config] = await Promise.all([
    getShowcaseCards(),
    getServices(),
    getIndustrialServices(),
    getSiteConfig(),
  ]);
  const copy = resolveCopy(config?.copy);
  // Resolved here so the right banner is in the HTML on first paint —
  // no extra request, `config` is already fetched above.
  const slides = resolveSlides(config?.slides, "home");

  /*
   * The second product row, above the booking forms.
   *
   * Resolved server-side and passed down, unlike the featured row, which
   * subscribes to the admin bridge's store. Only one of the two needs a live
   * subscription to look right, and this one is below the fold — a request per
   * visit to keep it hot is not worth it.
   *
   * `homeRowIds` order is the admin's, and getProductsByIds does not preserve
   * it, so it is re-sorted back. An id that no longer resolves drops out.
   */
  const homeRowIds = config?.homeRowIds ?? [];
  const homeRowFetched = homeRowIds.length > 0 ? await getProductsByIds(homeRowIds) : [];
  const homeRow = homeRowIds
    .map((id) => homeRowFetched.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

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
      <HeroBanner slides={slides} />

      <FeaturedEquipment />

      <ShowcaseStrip cards={showcase} />

      {/* The admin's second row. Hidden entirely when the list is empty, so an
          uncurated site doesn't show an empty scroller above the forms. */}
      {homeRow.length > 0 && (
        <FeaturedEquipment products={homeRow} label="More products" />
      )}

      <HomeBooking services={services} industrialServices={industrialServices} />
    </main>
  );
}
