import type { Metadata } from "next";
import { TodaySection } from "@/components/admin/today/today-section";

export const metadata: Metadata = { title: "Today" };

export default function Page() {
  return <TodaySection />;
}
