import type { Metadata } from "next";
import { OrdersSection } from "@/components/admin/section-orders";

export const metadata: Metadata = { title: "Orders" };

export default function Page() {
  return <OrdersSection />;
}
