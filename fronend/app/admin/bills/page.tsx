import type { Metadata } from "next";
import { InvoicesSection } from "@/components/admin/section-invoices";

export const metadata: Metadata = { title: "Bills" };

export default function Page() {
  return <InvoicesSection />;
}
