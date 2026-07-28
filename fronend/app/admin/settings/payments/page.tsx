import type { Metadata } from "next";
import { PaymentsSection } from "@/components/admin/section-payments";

export const metadata: Metadata = { title: "Payment" };

export default function Page() {
  return <PaymentsSection />;
}
