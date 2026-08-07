import type { Metadata } from "next";
import { ServicesPageScreen } from "@/components/admin/website/page-screens";

export const metadata: Metadata = { title: "Services page" };

export default function Page() {
  return <ServicesPageScreen />;
}
