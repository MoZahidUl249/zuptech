"use client";

import {
  BannerSlidesCard,
  ContactDetailsCard,
  CopyCard,
  FeaturedRowEditor,
  TrackingCard,
  CONTACT_COPY,
  FOOTER_COPY,
  HOME_COPY,
  INDUSTRIAL_COPY,
  SERVICES_COPY,
} from "../section-content";
import { ServiceCatalogueCard } from "../section-services";
import { TeamSection } from "../section-team";

/**
 * One screen per page of the website.
 *
 * Each screen is the page it edits, top to bottom: the wording, then whatever
 * cards and rows that page shows. Every control here changes something a
 * visitor can see — the per-page hero-art editor that used to head each screen
 * was removed with the feature, because no page had rendered that art since
 * the storefront was rebuilt around the banner carousel.
 */

/** Column shell — every screen is a stack of cards with the same gap. */
function Screen({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-5">{children}</div>;
}

export function HomePageScreen() {
  return (
    <Screen>
      <BannerSlidesCard page="home" />
      <FeaturedRowEditor />
      <CopyCard title="Home page wording" fields={HOME_COPY} />
      {/* The front page's own cards. Not the service catalogue — these exist so
          the home page can be rearranged without touching what the business
          sells, and vice versa. */}
      <ServiceCatalogueCard
        kind="showcase-cards"
        title="Showcase cards"
        blurb="The picture-and-text cards down the front page. These are for showing off work — nothing here is bookable, and changing them does not affect the services page or the industrial page at all."
      />
    </Screen>
  );
}

export function ServicesPageScreen() {
  return (
    <Screen>
      <BannerSlidesCard page="services" />
      <CopyCard title="Services page wording" fields={SERVICES_COPY} />
      <ServiceCatalogueCard
        kind="services"
        title="Service cards"
        blurb="The bookable service cards on the services page. Customers pick one of these when they book, so a card with enquiries attached can't be deleted. The home page has its own separate cards."
      />
    </Screen>
  );
}

export function IndustrialPageScreen() {
  return (
    <Screen>
      <BannerSlidesCard page="industrial" />
      <CopyCard title="Industrial page wording" fields={INDUSTRIAL_COPY} />
      <ServiceCatalogueCard
        kind="industrial-services"
        title="Capability cards"
        blurb="The infrastructure capability cards on the industrial page. Display-only — no enquiries attach to these."
      />
    </Screen>
  );
}

/** No page picture here: the contact page keeps its built-in grid so the
 *  headline and the form are the only things asking for attention. */
export function ContactPageScreen() {
  return (
    <Screen>
      <CopyCard title="Contact page wording" fields={CONTACT_COPY} />
      <ContactDetailsCard />
      <TeamSection />
    </Screen>
  );
}

/** The two things that aren't on one page: the footer, and the tag manager
 *  that loads on all of them. */
export function GlobalScreen() {
  return (
    <Screen>
      <CopyCard
        title="Footer wording"
        blurb="Shown at the bottom of every page. Leave it blank to use the site's built-in wording."
        fields={FOOTER_COPY}
      />
      <TrackingCard />
    </Screen>
  );
}
