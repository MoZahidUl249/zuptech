import { HeroCarousel } from "@/components/marketing/hero-carousel";
import type { HeroSlide } from "@/lib/admin";

/**
 * The admin-managed hero banner carousel.
 *
 * Takes its slides as a prop, resolved on the SERVER by the page that renders
 * it. That is the whole point: this used to read them from the client store, so
 * the server emitted the built-in banners and the real art only arrived after
 * the browser had fetched the site config — every refresh flashed the default
 * banner on the biggest element of the page, and the hero image was invisible
 * to the preload scanner because its URL did not exist until JS ran.
 *
 * Full-bleed: no max-width, no gutters, no rounded corners, so the art runs
 * edge to edge. The 5/2 desktop ratio matches the 2000×800 the admin asks
 * slides to be, so a correctly-sized banner fills the frame without cropping.
 */
export function HeroBanner({ slides }: { slides: HeroSlide[] }) {
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
