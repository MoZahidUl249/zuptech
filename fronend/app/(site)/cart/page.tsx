import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";
import { getProducts } from "@/lib/api";

/*
 * Rendered per request, not baked at build time.
 *
 * This page resolves cart ids to products so it can show a name, photo and
 * price per line. Prerendered, that lookup list is whatever `getProducts()`
 * returned DURING THE DOCKER BUILD — where no backend exists, so the call
 * falls back to the bundled demo catalogue and bakes ids like "ips1000" into
 * the page. At runtime the cart holds real ids, none of them match, and every
 * line is silently filtered out: the totals are right (they come from the live
 * quote) while the item list renders empty. That is exactly what it did.
 *
 * force-dynamic makes the fetch happen when someone opens the page, with the
 * backend reachable. The cost is one catalogue read per view of a page that is
 * already personal and uncacheable.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const products = await getProducts();
  return <CartView products={products} />;
}
