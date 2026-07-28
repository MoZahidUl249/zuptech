import type { Metadata } from "next";
import { CustomersSection } from "@/components/admin/section-tables";

export const metadata: Metadata = { title: "Customers" };

export default function Page() {
  return <CustomersSection />;
}
