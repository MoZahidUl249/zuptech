"use client";

import { createElement, useCallback, useMemo, useRef, useState } from "react";
import {
  SlidersHorizontal,
  LayoutGrid,
  Sun,
  BatteryCharging,
  ShieldCheck,
  Cable,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { ProductCard } from "@/components/product-card";
import { productSection, productTags, type Product } from "@/lib/products";
import { cn } from "@/lib/utils";

type Cat = "All" | "Industrial" | "Home";
type Tag = "All" | string;
type Sort = "popular" | "priceLow" | "priceHigh" | "rating";

const sortDefs: [Sort, string][] = [
  ["popular", "Most popular"],
  ["priceLow", "Price: low to high"],
  ["priceHigh", "Price: high to low"],
  ["rating", "Highest rated"],
];

/**
 * Fallback icons for the seed categories. Real categories are admin-managed
 * and carry their own logo (see CategoryIcon) — this map only covers the ones
 * that predate that, plus "All".
 */
const TAG_ICONS: Record<string, LucideIcon> = {
  Solar: Sun,
  Backup: BatteryCharging,
  Protection: ShieldCheck,
  Switchgear: Cable,
  Lighting: Lightbulb,
};
const tagIcon = (t: Tag): LucideIcon => (t === "All" ? LayoutGrid : (TAG_ICONS[t] ?? LayoutGrid));

/**
 * A category's own logo when the admin has set one, else a lucide fallback.
 *
 * `logo` is `Category.svgLogo` — SVG *markup*, not a URL, sanitized server-side
 * by `sanitizeSvgLogo` (backend/src/lib/rules.ts, covered by rules.test.ts),
 * which strips anything active. The backend ships it precisely so the
 * storefront can inline it; see backend/CLAUDE.md.
 */
function CategoryIcon({
  tag,
  logo,
  className,
}: {
  tag: Tag;
  logo?: string;
  className: string;
}) {
  if (tag !== "All" && logo) {
    return (
      <span
        aria-hidden
        className={cn(className, "[&>svg]:h-full [&>svg]:w-full")}
        dangerouslySetInnerHTML={{ __html: logo }}
      />
    );
  }
  // createElement, not `const Icon = …; <Icon />` — the latter reads as a
  // component defined during render to the lint rule (react-hooks/static-components).
  return createElement(tagIcon(tag), { className, strokeWidth: 2, "aria-hidden": true });
}

/**
 * Where the product grid should come to rest under the sticky chrome when a
 * category is picked. Header is `h-14` (56px, site-header.tsx) at every
 * breakpoint; below `lg` the category rail is sticky under it at ~58px.
 * Keep in step with the `scroll-mt-*` classes on the grid wrapper.
 */
const SCROLL_OFFSET = { mobile: 120, desktop: 72 } as const;

export function ShopBrowser({
  products,
  initialQuery = "",
}: {
  products: Product[];
  initialQuery?: string;
}) {
  const [cat, setCat] = useState<Cat>("All");
  const [tag, setTag] = useState<Tag>("All");
  const [sortBy, setSortBy] = useState<Sort>("popular");
  const [query, setQuery] = useState(initialQuery);
  const gridRef = useRef<HTMLDivElement>(null);

  /**
   * Bring the results to the shopper instead of making them hunt for them:
   * after a category changes, park the first product row directly under the
   * sticky header/rail. Every category control (rail, sidebar, filter sheet)
   * goes through this, so they all behave identically — including the
   * tap-again-to-clear toggle, which used to only work in two of the four.
   */
  const selectTag = useCallback(
    (t: Tag) => {
      setTag((current) => (current === t && t !== "All" ? "All" : t));

      // After paint, so the grid has its new height before we measure it.
      requestAnimationFrame(() => {
        const el = gridRef.current;
        if (!el) return;
        const offset = window.matchMedia("(min-width: 1024px)").matches
          ? SCROLL_OFFSET.desktop
          : SCROLL_OFFSET.mobile;
        // Already parked? Don't nudge the page for nothing.
        if (Math.abs(el.getBoundingClientRect().top - offset) < 8) return;
        el.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start",
        });
      });
    },
    [],
  );

  const list = useMemo(() => {
    let result = products;
    if (cat !== "All") result = result.filter((p) => productSection(p) === cat);
    if (tag !== "All") result = result.filter((p) => productTags(p).includes(tag));
    const q = query.trim().toLowerCase();
    if (q)
      result = result.filter((p) =>
        (p.name + " " + (productSection(p) ?? "") + " " + productTags(p).join(" "))
          .toLowerCase()
          .includes(q),
      );
    const sorted = [...result];
    if (sortBy === "priceLow") sorted.sort((a, b) => a.price - b.price);
    else if (sortBy === "priceHigh") sorted.sort((a, b) => b.price - a.price);
    else if (sortBy === "rating") sorted.sort((a, b) => b.rating - a.rating);
    else sorted.sort((a, b) => b.sold - a.sold);
    return sorted;
  }, [products, cat, tag, sortBy, query]);

  const filtersActive =
    cat !== "All" || tag !== "All" || sortBy !== "popular" || !!query.trim();
  const activeCount =
    (cat !== "All" ? 1 : 0) + (tag !== "All" ? 1 : 0) + (sortBy !== "popular" ? 1 : 0);

  const clearAll = () => {
    setCat("All");
    setTag("All");
    setSortBy("popular");
    setQuery("");
  };

  const catCount = (c: Cat) =>
    c === "All" ? products.length : products.filter((p) => productSection(p) === c).length;
  const tagCount = (t: Tag) => {
    const base = cat === "All" ? products : products.filter((p) => productSection(p) === cat);
    return t === "All" ? base.length : base.filter((p) => productTags(p).includes(t)).length;
  };

  // Tags are admin-managed and open-ended — build the "Type" filter from
  // whatever the live catalog actually has, not a fixed list.
  const availableTags = useMemo(
    () => Array.from(new Set(products.flatMap(productTags))).sort(),
    [products],
  );
  const tags: Tag[] = ["All", ...availableTags];

  // Each product carries its category's logo, so the filter list can show real
  // per-category art instead of one generic icon for everything the admin adds.
  const categoryLogos = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      if (p.category && p.categoryLogo && !map.has(p.category)) {
        map.set(p.category, p.categoryLogo);
      }
    }
    return map;
  }, [products]);

  return (
    <div className="mx-auto flex max-w-[1120px] items-start gap-9 px-5 pt-7">
      {/* Desktop sidebar */}
      <aside className="sticky top-19 hidden w-[220px] flex-none flex-col gap-6.5 pt-1.5 lg:flex">
        <div className="flex flex-col gap-2.5">
          <span className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-zup-soft">
            Sector
          </span>
          {(["All", "Industrial", "Home"] as Cat[]).map((c) => {
            const on = cat === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className="flex min-h-7 items-center gap-2.5 py-0.5 text-left"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 flex-none items-center justify-center rounded-full border-2",
                    on ? "border-zup-blue" : "border-zup-body/25",
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      on ? "bg-zup-blue" : "bg-transparent",
                    )}
                  />
                </span>
                <span
                  className={cn(
                    "text-sm",
                    on ? "font-bold text-zup-body" : "font-medium text-zup-gray",
                  )}
                >
                  {c}
                </span>
                <span className="ml-auto text-xs text-zup-faint">{catCount(c)}</span>
              </button>
            );
          })}
        </div>
        <div className="h-px bg-zup-body/7" />
        <div className="flex flex-col gap-2.5">
          <span className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-zup-soft">
            Category
          </span>
          {tags.map((t) => {
            const on = tag === t;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => selectTag(t)}
                className={cn(
                  "flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-0.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zup-blue",
                  on ? "bg-zup-blue/6" : "hover:bg-zup-body/4",
                )}
              >
                <CategoryIcon
                  tag={t}
                  logo={categoryLogos.get(t)}
                  className={cn("h-4 w-4 flex-none", on ? "text-zup-blue" : "text-zup-soft")}
                />
                <span
                  className={cn(
                    "text-sm",
                    on ? "font-bold text-zup-body" : "font-medium text-zup-gray",
                  )}
                >
                  {t}
                </span>
                <span className="ml-auto text-xs text-zup-faint">{tagCount(t)}</span>
              </button>
            );
          })}
        </div>
        <div className="h-px bg-zup-body/7" />
        <div className="flex flex-col gap-2.5">
          <label
            htmlFor="shop-sort"
            className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-zup-soft"
          >
            Sort by
          </label>
          <select
            id="shop-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as Sort)}
            className="cursor-pointer appearance-none rounded-[10px] border border-zup-body/10 bg-white px-3 py-2.5 text-[13.5px] font-semibold text-zup-mid outline-none"
          >
            {sortDefs.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {filtersActive && (
          <button
            type="button"
            onClick={clearAll}
            className="self-start text-[13px] font-semibold text-zup-blue transition-colors hover:text-zup-blue-dark"
          >
            Clear filters ×
          </button>
        )}
      </aside>

      <div className="min-w-0 flex-1">
        {/*
          No search box here. The header carries one at every breakpoint now,
          and this sat directly beneath it — two identical "Search products…"
          fields on the same screen. Searching from the header lands on
          /shop?q=…, which seeds `query` below, so the behaviour is unchanged;
          the term is shown back to the visitor in the header's own field.
        */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 px-1">
          <h1 className="text-[clamp(28px,4.4vw,38px)] font-bold tracking-[-0.025em]">
            Shop
          </h1>
          {query.trim() && (
            <p className="text-[13.5px] text-zup-gray">
              Showing results for{" "}
              <span className="font-semibold text-zup-body">{query.trim()}</span>
            </p>
          )}
        </div>

        {/*
          Category rail + filter sheet. This used to sit below a grid of tall
          category cards that repeated the very same list — on a phone that was
          three rows of tiles to scroll past before the first product. The rail
          is the single control now, and it stays pinned under the header so
          switching category never means scrolling back up. Desktop keeps the
          sidebar list instead (lg:hidden below).
        */}
        <div className="zup-scroll-row sticky top-14 z-40 -mx-5 flex snap-x gap-2 overflow-x-auto overscroll-x-contain bg-zup-bg/92 px-5 py-2.5 backdrop-blur-md lg:hidden">
          <Sheet>
            <SheetTrigger
              className={cn(
                "flex min-h-[38px] flex-none items-center gap-[7px] whitespace-nowrap rounded-full border px-4 py-[9px] text-[13px] font-semibold",
                activeCount > 0
                  ? "border-zup-blue bg-zup-blue text-white"
                  : "border-zup-body/12 bg-white text-zup-mid",
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
              Filters{activeCount > 0 ? ` · ${activeCount}` : ""}
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[82vh] rounded-t-[22px]">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-5.5 overflow-y-auto px-4 pb-4">
                <div className="flex flex-col gap-2.5">
                  <span className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-zup-soft">
                    Sector
                  </span>
                  <div className="flex gap-2">
                    {(["All", "Industrial", "Home"] as Cat[]).map((c) => {
                      const on = cat === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCat(c)}
                          className={cn(
                            "min-h-[46px] flex-1 rounded-xl border-[1.5px] px-2 py-3 text-sm font-semibold",
                            on
                              ? "border-zup-blue bg-zup-blue/6 text-zup-blue"
                              : "border-zup-body/10 bg-white text-zup-mid",
                          )}
                        >
                          {c}{" "}
                          <span className="text-[11.5px] opacity-60">{catCount(c)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-2.5">
                  <span className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-zup-soft">
                    Category
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((t) => {
                      const on = tag === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          aria-pressed={on}
                          onClick={() => selectTag(t)}
                          className={cn(
                            "min-h-11 cursor-pointer rounded-full border-[1.5px] px-4 py-[11px] text-[13.5px] font-semibold",
                            on
                              ? "border-zup-blue bg-zup-blue/6 text-zup-blue"
                              : "border-zup-body/10 bg-white text-zup-mid",
                          )}
                        >
                          {t} <span className="text-[11px] opacity-60">{tagCount(t)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-2.5">
                  <span className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-zup-soft">
                    Sort by
                  </span>
                  <div className="flex flex-col gap-2">
                    {sortDefs.map(([value, label]) => {
                      const on = sortBy === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setSortBy(value)}
                          className={cn(
                            "flex min-h-[46px] items-center gap-[11px] rounded-xl border-[1.5px] px-3.5 py-3 text-left",
                            on ? "border-zup-blue bg-zup-blue/5" : "border-zup-body/8 bg-white",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-[17px] w-[17px] flex-none items-center justify-center rounded-full border-2",
                              on ? "border-zup-blue" : "border-zup-body/25",
                            )}
                          >
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                on ? "bg-zup-blue" : "bg-transparent",
                              )}
                            />
                          </span>
                          <span className="text-sm font-semibold">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <SheetFooter className="flex-row gap-2.5 border-t border-zup-body/7 bg-white">
                <button
                  type="button"
                  onClick={clearAll}
                  className="min-h-[52px] flex-none rounded-[14px] border-[1.5px] border-zup-body/12 px-5 text-[14.5px] font-semibold text-zup-mid"
                >
                  Clear
                </button>
                <SheetClose className="min-h-[52px] flex-1 rounded-[14px] bg-zup-orange text-[15.5px] font-bold text-white shadow-[0_6px_18px_rgba(232,83,32,.25)] transition-colors hover:bg-zup-orange-dark">
                  Show {list.length} products
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          {tags.map((t) => {
            const on = tag === t;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => selectTag(t)}
                className={cn(
                  // min-h-11 = 44px, the minimum comfortable touch target.
                  "flex min-h-11 flex-none cursor-pointer snap-start items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zup-blue",
                  on
                    ? "border-zup-blue bg-zup-blue text-white"
                    : "border-zup-body/12 bg-white text-zup-mid",
                )}
              >
                <CategoryIcon tag={t} logo={categoryLogos.get(t)} className="h-4 w-4 flex-none" />
                {t}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[11px] font-bold",
                    on ? "bg-white/22 text-white" : "bg-zup-body/7 text-zup-gray",
                  )}
                >
                  {tagCount(t)}
                </span>
              </button>
            );
          })}
        </div>

        {/*
          The scroll target for selectTag. scroll-mt clears the sticky header
          (56px) plus, below lg, the category rail (~58px) — keep these in step
          with SCROLL_OFFSET above.
        */}
        <div ref={gridRef} id="shop-products" className="scroll-mt-[120px] lg:scroll-mt-18">
          {/* Visible on every breakpoint: it is the confirmation that tapping
              a category actually changed something, for sighted and
              screen-reader users alike. */}
          <p className="mb-0.5 px-1 pt-2 text-[13px] text-zup-soft lg:pt-0" aria-live="polite">
            {list.length} {list.length === 1 ? "product" : "products"}
            {tag !== "All" ? ` in ${tag}` : ""}
          </p>

          {list.length === 0 ? (
            <div className="mt-3.5 rounded-[20px] border border-zup-body/6 bg-white px-5 py-14 text-center">
              <p className="mb-1.5 text-[15px] font-semibold">No products found</p>
              <p className="mb-4.5 text-[13.5px] text-zup-gray">
                Try a different search or clear your filters.
              </p>
              <button
                type="button"
                onClick={clearAll}
                className="cursor-pointer rounded-full bg-zup-blue px-[22px] py-[11px] text-sm font-semibold text-white transition-colors hover:bg-zup-blue-dark"
              >
                Clear all
              </button>
            </div>
          ) : (
            <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] sm:gap-3">
              {list.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
        <div className="h-24" />
      </div>
    </div>
  );
}
