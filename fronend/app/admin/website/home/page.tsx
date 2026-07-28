import type { Metadata } from "next";
import { HomePageSection } from "@/components/admin/section-content";

export const metadata: Metadata = { title: "Home page" };

export default function Page() {
  return <HomePageSection />;
}
