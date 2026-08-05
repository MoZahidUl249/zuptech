"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { useFeaturedProducts } from "@/lib/admin-bridge";

export function FeaturedEquipment() {
  const products = useFeaturedProducts();
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    rowRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    // The visible heading is gone, so the region names itself. Without this
    // the section would be an unlabelled landmark — the arrows are the only
    // thing left in the header row.
    <section className="px-5 py-10" aria-label="Featured products">
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

        <div className="mt-7 flex justify-center">
          <Link
            href="/shop"
            className="rounded-full bg-zup-ink px-6 py-3 text-[13.5px] font-bold uppercase tracking-[0.04em] text-white transition-colors hover:bg-zup-body"
          >
            View All Products →
          </Link>
        </div>
      </div>
    </section>
  );
}
