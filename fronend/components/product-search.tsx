"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Product search for the site header.
 *
 * Deliberately a plain form that navigates rather than a live dropdown: the
 * catalogue browser on /products already does the filtering, and pushing the query
 * into its URL means one search implementation instead of two that can
 * disagree — and a result page that can be linked, shared and bookmarked,
 * which the shop's own box could not do while its state was local-only.
 */
export function ProductSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        // An empty search is "show me everything", not a no-op — going to the
        // unfiltered shop is the least surprising outcome.
        router.push(term ? `/products?q=${encodeURIComponent(term)}` : "/products");
      }}
      className={cn("relative", className)}
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zup-gray"
        aria-hidden
      />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search products…"
        aria-label="Search products"
        className="min-h-9 w-full rounded-full border border-zup-body/10 bg-white py-1.5 pl-9 pr-3 text-[13.5px] outline-none transition-colors focus:border-zup-blue [&::-webkit-search-cancel-button]:hidden"
      />
    </form>
  );
}
