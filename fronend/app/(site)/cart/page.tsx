import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";
import { getProducts } from "@/lib/api";

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const products = await getProducts();
  return <CartView products={products} />;
}
