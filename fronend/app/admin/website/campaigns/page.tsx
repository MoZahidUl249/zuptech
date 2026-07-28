import type { Metadata } from "next";
import { LandingPagesSection } from "@/components/admin/section-landing-pages";

export const metadata: Metadata = { title: "Campaign pages" };

export default function Page() {
  return <LandingPagesSection />;
}
