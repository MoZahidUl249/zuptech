"use client";

import { useHeroSlides } from "@/lib/admin-bridge";
import { HeroCarousel } from "@/components/marketing/hero-carousel";

/**
 * The admin-managed hero banner carousel — now the homepage's entire hero.
 *
 * Full-bleed: no max-width, no gutters, no rounded corners, so the art runs
 * edge to edge. The 5/2 desktop ratio matches the 2000×800 the admin asks
 * slides to be, so a correctly-sized banner fills the frame without cropping.
 *
 * The carousel itself lives in HeroCarousel, shared with the per-page poster
 * backdrops — this component is now just the homepage's data source and frame.
 */
export function HeroBanner() {
  const slides = useHeroSlides();
  if (slides.length === 0) return null;

  return (
    <div className="w-full">
      <HeroCarousel
        label="Featured promotions"
        priorityFirst
        className="aspect-[16/7] w-full sm:aspect-[5/2]"
        slides={slides.map((s) => ({
          id: s.id,
          image: s.image,
          mediaType: s.mediaType,
          cta: s.cta,
          href: s.href,
          fit: s.fit,
          bg: s.bg,
        }))}
      />
    </div>
  );
}
