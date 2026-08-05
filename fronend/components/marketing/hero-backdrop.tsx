"use client";

import Image from "next/image";
import type { PageHero } from "@/lib/api";
import { HeroCarousel } from "@/components/marketing/hero-carousel";

/**
 * The art behind a page hero: nothing, one still image, or a sliding poster
 * carousel — whichever the admin configured for this page.
 *
 * Purely a backdrop: it sits in the hero's padding box under the headline
 * block and never intercepts a CTA click. Every layer is absolutely
 * positioned, so switching modes cannot change the hero's height and reflow
 * the page.
 *
 * The poster set used to cross-fade through its own timer here. It runs on the
 * shared HeroCarousel now, so a poster set and the homepage promo banners move
 * the same way instead of being two hand-rolled rotations that had already
 * drifted apart.
 */
export function HeroBackdrop({ hero }: { hero?: PageHero }) {
  if (!hero || hero.mode === "plain") return null;

  const scrim = Math.min(100, Math.max(0, hero.overlay)) / 100;

  if (hero.mode === "image") {
    if (!hero.background) return null;
    return (
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Image
          src={hero.background}
          alt=""
          fill
          // Full-bleed band, so it is viewport-wide at every breakpoint.
          sizes="100vw"
          className="object-cover"
          // The hero is the LCP element on every page that has one.
          priority
        />
        <div className="absolute inset-0 bg-zup-ink" style={{ opacity: scrim }} />
      </div>
    );
  }

  const posters = hero.posters;
  if (posters.length === 0) return null;

  return (
    <HeroCarousel
      // Decorative: the page's own <h1> and CTAs sit on top and are the
      // accessible content. Controls here would compete with them for focus,
      // and the poster art carries no information the copy doesn't.
      decorative
      priorityFirst
      overlayOpacity={scrim}
      className="absolute inset-0"
      slides={posters.map((p) => ({ id: p.id, image: p.image, fit: "cover" as const }))}
    />
  );
}
