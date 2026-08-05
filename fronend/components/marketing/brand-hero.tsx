import Link from "next/link";
import { HeroBackdrop } from "./hero-backdrop";
import type { PageHero } from "@/lib/api";

/**
 * Dark, headline-led marketing hero — an alternative to the e-commerce
 * HeroBanner carousel for pages that need to lead with a brand statement
 * rather than a promo image (e.g. the homepage's "dark" hero variant,
 * the /industrial B2B page). Kept as its own component rather than a mode
 * of HeroBanner: HeroBanner's data model (per-slide image + one CTA +
 * auto-advance) doesn't naturally extend to "eyebrow + headline + subhead +
 * two CTAs" without forking every consumer of HeroSlide.
 */
export function BrandHero({
  eyebrow,
  headline,
  subhead,
  primaryCta,
  secondaryCta,
  hero,
}: {
  eyebrow: string;
  headline: string;
  subhead: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
  /** Admin-configured art. Omitted or `mode: "plain"` keeps the built-in
   *  dark grid design below. */
  hero?: PageHero;
}) {
  // The grid texture is the *plain* look; with art behind it, it would fight
  // the photo instead of decorating it.
  //
  // Checked against the art itself, not just the mode: a page set to "posters"
  // with none uploaded (or "image" with the background cleared) renders no
  // backdrop, and suppressing the grid for it left an empty dark band.
  const hasArt = Boolean(
    hero &&
      ((hero.mode === "image" && hero.background) ||
        (hero.mode === "posters" && hero.posters.length > 0)),
  );
  return (
    <section className="relative overflow-hidden bg-zup-ink px-5 py-20 sm:py-26">
      <HeroBackdrop hero={hero} />
      {hasArt ? null : (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:34px_34px]"
          aria-hidden
        />
      )}
      <div className="relative mx-auto max-w-[1120px]">
        <span className="mb-5 inline-block rounded-md border border-zup-orange/50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-zup-orange">
          {eyebrow}
        </span>
        <h1 className="mb-4 max-w-[720px] text-[clamp(34px,5.5vw,56px)] font-bold leading-[1.05] tracking-[-0.03em] text-zup-bg">
          {headline}
        </h1>
        <p className="mb-8 max-w-[560px] text-base leading-relaxed text-[#A7ACB5] sm:text-[17px]">
          {subhead}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={primaryCta.href}
            className="rounded-full bg-zup-orange px-7 py-[15px] text-sm font-bold uppercase tracking-[0.04em] text-white shadow-[0_8px_24px_rgba(232,83,32,.28)] transition-colors hover:bg-zup-orange-dark"
          >
            {primaryCta.label} →
          </Link>
          <Link
            href={secondaryCta.href}
            className="rounded-full border border-white/25 px-7 py-[15px] text-sm font-bold uppercase tracking-[0.04em] text-zup-bg transition-colors hover:bg-white/8"
          >
            {secondaryCta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
