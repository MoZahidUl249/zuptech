import type { Metadata } from "next";
import { LeadsSection } from "@/components/admin/section-tables";

export const metadata: Metadata = { title: "Service requests" };

export default function Page() {
  return <LeadsSection />;
}
