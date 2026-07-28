import type { Metadata } from "next";
import { TaxonomySection } from "@/components/admin/section-taxonomy";

export const metadata: Metadata = { title: "Categories" };

export default function Page() {
  return <TaxonomySection />;
}
