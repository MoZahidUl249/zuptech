import type { Metadata } from "next";
import { HomePageScreen } from "@/components/admin/website/page-screens";

export const metadata: Metadata = { title: "Home page" };

export default function Page() {
  return <HomePageScreen />;
}
