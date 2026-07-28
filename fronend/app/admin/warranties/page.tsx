import type { Metadata } from "next";
import { WarrantySection } from "@/components/admin/section-warranty";

export const metadata: Metadata = { title: "Warranties" };

export default function Page() {
  return <WarrantySection />;
}
