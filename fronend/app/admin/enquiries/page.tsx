import type { Metadata } from "next";
import { IndustrialLeadsSection } from "@/components/admin/section-tables";

export const metadata: Metadata = { title: "Business enquiries" };

export default function Page() {
  return <IndustrialLeadsSection />;
}
