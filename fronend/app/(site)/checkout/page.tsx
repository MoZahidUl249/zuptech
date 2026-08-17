import type { Metadata } from "next";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { getProducts } from "@/lib/api";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  /* Same fetch the cart page does. Only the analytics needs it — the money
     still comes from the server quote — but reporting an id where a name
     belongs makes every GA4 report unreadable. */
  const products = await getProducts();
  return <CheckoutFlow products={products} />;
}
