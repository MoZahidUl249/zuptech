import type { Metadata, Viewport } from "next";
import { AdminApp } from "@/components/admin/admin-app";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#12161d",
  width: "device-width",
  initialScale: 1,
};

export default function AdminPage() {
  return <AdminApp />;
}
