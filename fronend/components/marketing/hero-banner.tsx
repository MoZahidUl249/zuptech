"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useHeroSlides } from "@/lib/admin-bridge";
import { cn } from "@/lib/utils";

const ADVANCE_MS = 6000;

/**
 * The admin-managed hero banner ("poster") carousel.
 *
 * Sits below BrandHero rather than replacing it: this is a client component,
 * so swapping the server-rendered hero on hydration would shift the layout and
 * change the page's <h1> after paint.
 */
export function HeroBanner() {
  const slides = useHeroSlides();
  const [rawIndex, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = usePrefersReducedMotion();

  const count = slides.length;
  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  // Derived, not stored: if the admin removes slides while the page is open the
  // held index can fall out of range. Clamping here (rather than correcting
  // state in an effect) avoids a cascading re-render.
  const index = count > 0 ? rawIndex % count : 0;

  useEffect(() => {
    if (count < 2 || paused || reduceMotion) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), ADVANCE_MS);
    return () => clearInterval(t);
  }, [count, paused, reduceMotion]);

  if (count === 0) return null;

  const multi = count > 1;

  return (
    <section
      aria-label="Featured promotions"
      aria-roledescription={multi ? "carousel" : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="mx-auto w-full max-w-7xl px-4 sm:px-6"
    >
      <div className="relative aspect-[16/7] w-full overflow-hidden rounded-2xl sm:aspect-[5/2]">
        {slides.map((s, i) => (
          <div
            key={s.id}
            aria-hidden={i !== index}
            style={{ background: s.bg || undefined }}
            className={cn(
              "absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none",
              i === index ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            {s.image ? (
              <Image
                src={s.image}
                alt=""
                fill
                // First slide is the LCP candidate on the homepage.
                priority={i === 0}
                sizes="(max-width: 1280px) 100vw, 1280px"
                className={cn(
                  (s.fit ?? "cover") === "contain" ? "object-contain" : "object-cover",
                )}
              />
            ) : null}

            {s.cta ? (
              <div className="absolute inset-x-0 bottom-0 flex justify-center p-4 sm:justify-start sm:p-8">
                <Link
                  href={s.href || "/shop"}
                  tabIndex={i === index ? 0 : -1}
                  className="inline-flex min-h-11 items-center rounded-full bg-white px-6 text-sm font-bold text-zup-body shadow-lg transition-colors hover:bg-zup-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {s.cta}
                </Link>
              </div>
            ) : null}
          </div>
        ))}

        {multi ? (
          <>
            <CarouselArrow side="left" onClick={() => go(index - 1)} />
            <CarouselArrow side="right" onClick={() => go(index + 1)} />
            <div className="absolute inset-x-0 top-3 flex justify-center gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Go to slide ${i + 1} of ${count}`}
                  aria-current={i === index}
                  onClick={() => go(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === index ? "w-6 bg-white" : "w-1.5 bg-white/55 hover:bg-white/80",
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function CarouselArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous slide" : "Next slide"}
      className={cn(
        "absolute top-1/2 hidden -translate-y-1/2 rounded-full bg-black/35 p-2 text-white transition-colors hover:bg-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:block",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  const mqRef = useRef<MediaQueryList | null>(null);

  useEffect(() => {
    mqRef.current = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mq = mqRef.current;
    setReduce(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduce;
}
