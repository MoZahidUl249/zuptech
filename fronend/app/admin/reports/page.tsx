import type { Metadata } from "next";
import { AnalyticsSection } from "@/components/admin/section-analytics";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return <AnalyticsSection />;
}
