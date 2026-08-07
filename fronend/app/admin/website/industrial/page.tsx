import type { Metadata } from "next";
import { IndustrialPageScreen } from "@/components/admin/website/page-screens";

export const metadata: Metadata = { title: "Industrial page" };

export default function Page() {
  return <IndustrialPageScreen />;
}
