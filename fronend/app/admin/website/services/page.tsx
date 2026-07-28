import type { Metadata } from "next";
import { ServicesSection } from "@/components/admin/section-services";

export const metadata: Metadata = { title: "Services" };

export default function Page() {
  return <ServicesSection />;
}
