import type { Metadata } from "next";
import { PageHeroesSection } from "@/components/admin/section-page-heroes";

export const metadata: Metadata = { title: "Page pictures" };

export default function Page() {
  return <PageHeroesSection />;
}
