import type { Metadata } from "next";
import { ContactPageScreen } from "@/components/admin/website/page-screens";

export const metadata: Metadata = { title: "Contact page" };

export default function Page() {
  return <ContactPageScreen />;
}
