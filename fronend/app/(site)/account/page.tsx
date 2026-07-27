import type { Metadata } from "next";
import { AccountView } from "@/components/account-view";
import { getProducts } from "@/lib/api";

export const metadata: Metadata = {
  title: "My Account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const products = await getProducts();
  const productNames = Object.fromEntries(products.map((p) => [p.id, p.name]));
  return <AccountView productNames={productNames} />;
}
