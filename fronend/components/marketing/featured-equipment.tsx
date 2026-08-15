"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/products";
import { useFeaturedProducts } from "@/lib/admin-bridge";
import { usePrefersReducedMotion } from "@/components/marketing/hero-carousel";

/** How long a card holds before the row advances. Matches the hero's dwell. */
const ADVANCE_MS = 6000;
/** Card width + gap — the distance one step travels. */
const STEP_PX = 220 + 14;

/**
 * A horizontally-scrolling product row.
 *
 * Two of these on the home page now: the featured row under the hero, and a
 * second one above the booking forms. The featured one keeps its live store
 * subscription (a change in another tab appears without a reload); the second
 * takes its products as a prop, resolved server-side from `homeRowIds`.
 *
 * The prop is optional rather than required so the featured usage is unchanged
 * and there is only one auto-advancing row implementation to maintain.
 */
export function FeaturedEquipment({
  products: override,
  label = "Featured products",
}: {
  products?: Product[];
  label?: string;
} = {}) {
  const featured = useFeaturedProducts();
  const products = override ?? featured;
  const rowRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);

  const scroll = useCallback((dir: 1 | -1) => {
    const el = rowRef.current;
    if (!el) return;
    // At the end, wrap to the start rather than stalling against the edge —
    // an auto-advancing row that dead-ends looks broken. 4px of slack absorbs
    // sub-pixel scroll widths.
    if (dir === 1 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) {
      el.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    if (dir === -1 && el.scrollLeft <= 4) {
      el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
      return;
    }
    el.scrollBy({ left: dir * STEP_PX, behavior: "smooth" });
  }, []);

  useEffect(() => {
    // Nothing to advance through, and no motion under a reduced-motion
    // preference — the row stays a plain scroller the visitor drives.
    if (reduceMotion || paused || products.length < 2) return;
    const t = setInterval(() => scroll(1), ADVANCE_MS);
    return () => clearInterval(t);
  }, [reduceMotion, paused, products.length, scroll]);

  return (
    // The visible heading is gone, so the region names itself. Without this
    // the section would be an unlabelled landmark — the arrows are the only
    // thing left in the header row.
    <section
      className="px-5 py-10"
      aria-label={label}
      // Pause while the visitor is reading or touching the row, so it can't
      // slide a card out from under a tap.
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div className="mx-auto max-w-[1120px]">
        {/* The arrows are the whole header row now. They carry the row's own
            margin rather than sitting inside a wrapper, because the wrapper
            kept its height on mobile — where the arrows are hidden — and left
            a band of dead space above the products. */}
        <div className="mb-5 hidden justify-end gap-2 sm:flex">
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label="Scroll left"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zup-body/12 text-zup-mid transition-colors hover:bg-zup-body/4"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label="Scroll right"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zup-body/12 text-zup-mid transition-colors hover:bg-zup-body/4"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div
          ref={rowRef}
          className="zup-scroll-row -mx-5 flex snap-x snap-mandatory gap-3.5 overflow-x-auto scroll-smooth px-5 pb-1"
        >
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              className="w-[220px] flex-none snap-start"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
