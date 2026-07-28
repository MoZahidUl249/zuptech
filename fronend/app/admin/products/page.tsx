import type { Metadata } from "next";
import { ProductsSection } from "@/components/admin/products/products-list";

export const metadata: Metadata = { title: "Products" };

export default function Page() {
  return <ProductsSection />;
}
