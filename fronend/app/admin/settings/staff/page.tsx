import type { Metadata } from "next";
import { StaffSection } from "@/components/admin/section-staff";

export const metadata: Metadata = { title: "Team" };

export default function Page() {
  return <StaffSection />;
}
