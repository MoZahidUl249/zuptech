"use client";

import { useHeroSlides } from "@/lib/admin-bridge";
import { HeroCarousel } from "@/components/marketing/hero-carousel";

/**
 * The admin-managed hero banner carousel on the homepage.
 *
 * Sits below BrandHero rather than replacing it: this is a client component,
 * so swapping the server-rendered hero on hydration would shift the layout and
 * change the page's <h1> after paint.
 *
 * The carousel itself lives in HeroCarousel, shared with the per-page poster
 * backdrops — this component is now just the homepage's data source and frame.
 */
export function HeroBanner() {
  const slides = useHeroSlides();
  if (slides.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
      <HeroCarousel
        label="Featured promotions"
        priorityFirst
        className="aspect-[16/7] w-full rounded-2xl sm:aspect-[5/2]"
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
