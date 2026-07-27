"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { useFeaturedProducts, useSiteCopy } from "@/lib/admin-bridge";

export function FeaturedEquipment() {
  const products = useFeaturedProducts();
  const copy = useSiteCopy();
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    rowRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    <section className="px-5 py-16" aria-labelledby="featured-equipment-heading">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <span className="mb-3 block text-xs font-bold uppercase tracking-[0.14em] text-zup-orange">
              Hardware catalogue
            </span>
            <h2
              id="featured-equipment-heading"
              className="text-[clamp(24px,3.6vw,34px)] font-bold tracking-[-0.02em]"
            >
              {copy.featuredHeading}
            </h2>
          </div>
          <div className="hidden gap-2 sm:flex">
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
