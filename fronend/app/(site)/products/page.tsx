import type { Metadata } from "next";
import Link from "next/link";
import { ProductsBrowser } from "@/components/products-browser";
import { getProductPage } from "@/lib/api";
import { site , jsonLd } from "@/lib/site";

export const metadata: Metadata = {
  title: "Products — IPS, Solar, Stabilizers & Switchgear",
  description:
    "Buy power products in Bangladesh from ZUP TECH: IPS + battery combos, solar home systems, voltage stabilizers, transformers, switchgear panels and more. bKash, Nagad & Cash on Delivery. Professional setup available.",
  alternates: { canonical: "/products" },
  openGraph: {
    title: "Products | ZUP TECH",
    description:
      "IPS, solar systems, stabilizers, transformers and switchgear — engineered hardware with professional installation across Bangladesh.",
    url: `${site.url}/products`,
  },
};

/** Products per page. Matches DEFAULT_PAGE_SIZE in the backend's rules.ts. */
const PAGE_SIZE = 48;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  /*
   * One page of the catalog, not the whole thing.
   *
   * This page used to render every visible product server-side: 1.4 MB of HTML
   * per request at 500 rows, and it got slower as the shop grew. It served 15
   * requests a second while the home page served over a thousand, which made
   * one route the ceiling for the entire site and drove the storefront into
   * repeated out-of-memory restarts under load.
   *
   * Search goes to the server with the request, so it reaches the whole
   * catalog rather than filtering whatever happened to be on the page.
   */
  const { q, page } = await searchParams;
  const current = Math.max(1, Number(page) || 1);
  const { products, total } = await getProductPage({
    q,
    limit: PAGE_SIZE,
    offset: (current - 1) * PAGE_SIZE,
  });
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (n: number) =>
    `/products?${new URLSearchParams({ ...(q ? { q } : {}), ...(n > 1 ? { page: String(n) } : {}) })}`;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "ZUP TECH product catalog",
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${site.url}/products/${p.slug}`,
      name: p.name,
    })),
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(itemListJsonLd) }}
      />
      {/*
        Keyed on the query so a new search from the header remounts the
        browser. `initialQuery` only seeds useState, so without this a visitor
        already on /products could search again, watch the URL change, and see the
        same results — the state kept the first query forever. That was
        invisible while the page had its own search box; now that the header's
        is the only one on desktop, it is the search.
      */}
      <ProductsBrowser key={q ?? ""} products={products} initialQuery={q ?? ""} />

      {/*
        Paging is plain links, not a button that fetches: each page is its own
        URL, so it is shareable, indexable and survives a back button. The
        category chips inside ProductsBrowser still filter within the page — moving
        those to the server is the next step, and until it happens a shop with
        more than one page should lean on search rather than the chips.
      */}
      {lastPage > 1 && (
        <nav
          aria-label="Catalog pages"
          className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pb-16 pt-2 text-ui-sm"
        >
          {current > 1 ? (
            <Link
              href={href(current - 1)}
              rel="prev"
              className="rounded-full border border-zup-line px-4 py-2 font-bold transition-colors hover:bg-zup-mist"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}

          <span className="text-zup-body">
            Page {current} of {lastPage} · {total} products
          </span>

          {current < lastPage ? (
            <Link
              href={href(current + 1)}
              rel="next"
              className="rounded-full border border-zup-line px-4 py-2 font-bold transition-colors hover:bg-zup-mist"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  );
}
