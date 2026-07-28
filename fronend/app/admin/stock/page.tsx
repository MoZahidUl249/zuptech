import type { Metadata } from "next";
import { InventorySection } from "@/components/admin/stock/stock-list";

export const metadata: Metadata = { title: "Stock" };

export default function Page() {
  return <InventorySection />;
}
