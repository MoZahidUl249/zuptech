import type { Metadata } from "next";
import { ShippingSection } from "@/components/admin/section-shipping";

export const metadata: Metadata = { title: "Delivery" };

export default function Page() {
  return <ShippingSection />;
}
