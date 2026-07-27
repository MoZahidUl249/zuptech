import type { Metadata } from "next";
import { CheckoutFlow } from "@/components/checkout-flow";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return <CheckoutFlow />;
}
