import type { Metadata } from "next";
import { ShopBrowser } from "@/components/shop-browser";
import { getProducts } from "@/lib/api";
import { site , jsonLd } from "@/lib/site";

export const metadata: Metadata = {
  title: "Shop Power Products — IPS, Solar, Stabilizers & Switchgear",
  description:
    "Buy power products in Bangladesh from ZUP TECH: IPS + battery combos, solar home systems, voltage stabilizers, transformers, switchgear panels and more. bKash, Nagad & Cash on Delivery. Professional setup available.",
  alternates: { canonical: "/shop" },
  openGraph: {
    title: "Shop Power Products | ZUP TECH",
    description:
      "IPS, solar systems, stabilizers, transformers and switchgear — engineered hardware with professional installation across Bangladesh.",
    url: `${site.url}/shop`,
  },
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, products] = await Promise.all([searchParams, getProducts()]);

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
        already on /shop could search again, watch the URL change, and see the
        same results — the state kept the first query forever. That was
        invisible while the page had its own search box; now that the header's
        is the only one on desktop, it is the search.
      */}
      <ShopBrowser key={q ?? ""} products={products} initialQuery={q ?? ""} />
    </main>
  );
}
