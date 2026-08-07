import type { ServiceCard } from "@/lib/api";
import { ServiceCardView } from "./service-card";

/**
 * The home page's showcase row.
 *
 * These are `ShowcaseCard` rows, not the bookable service catalogue. The home
 * page used to render `Service` directly, which meant an admin could not
 * change the front page without changing what /services sells — and could not
 * change /services without rearranging the front page. They are separate
 * tables now, and this component only ever sees the showcase one.
 *
 * No `.slice()`: how many cards the front page shows is the admin's decision,
 * not this component's. Renders nothing when the list is empty, so an
 * unreachable backend leaves no empty heading behind.
 */
export function ShowcaseStrip({ cards }: { cards: ServiceCard[] }) {
  if (cards.length === 0) return null;

  return (
    // The region names itself: the cards are the whole section, there is no
    // heading to point an aria-labelledby at.
    <section className="px-5 py-10" aria-label="What we do">
      <div className="mx-auto max-w-[1120px]">
        <div className="flex flex-col gap-6">
          {cards.map((c) => (
            <ServiceCardView key={c.id} service={c} />
          ))}
        </div>
      </div>
    </section>
  );
}
