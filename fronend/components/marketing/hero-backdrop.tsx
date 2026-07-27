"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { PageHero } from "@/lib/api";

/**
 * The art behind a page hero: nothing, one still image, or a rotating poster
 * set — whichever the admin configured for this page.
 *
 * Purely a backdrop: it sits in the hero's padding box under the headline
 * block and is `pointer-events-none`, so it can never intercept a CTA click.
 * Every layer is absolutely positioned, so switching modes cannot change the
 * hero's height and reflow the page.
 */
export function HeroBackdrop({ hero }: { hero?: PageHero }) {
  const posters = hero?.mode === "posters" ? hero.posters : [];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // One poster needs no timer, and running one would keep the tab busy for
    // nothing.
    if (posters.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % posters.length), 6000);
    return () => clearInterval(id);
  }, [posters.length]);

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

  if (posters.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {posters.map((poster, i) => (
        <div
          key={poster.id}
          // Cross-fade rather than swap: opacity animates on the compositor,
          // so the rotation costs no layout work.
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === index ? 1 : 0 }}
        >
          <Image
            src={poster.image}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            priority={i === 0}
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-zup-ink" style={{ opacity: scrim }} />
    </div>
  );
}
