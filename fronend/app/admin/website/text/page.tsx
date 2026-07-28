import type { Metadata } from "next";
import { SiteContentSection } from "@/components/admin/section-content";

export const metadata: Metadata = { title: "Text & contact" };

export default function Page() {
  return <SiteContentSection />;
}
