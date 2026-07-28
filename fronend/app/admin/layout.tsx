import type { Metadata } from "next";
import { AdminBoundary } from "@/components/admin/shell/admin-boundary";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · ZUP TECH Admin" },
  robots: { index: false, follow: false },
};

/**
 * The admin's outer frame.
 *
 * `AdminProvider` lives here rather than in a page, and that placement is
 * load-bearing: Next does not remount a layout when a child route changes, so
 * the sixteen-request `loadAdminState()` still runs exactly once per session
 * and the debounced save engine's serverRef/dirtyRef survive navigation. Move
 * the provider into a page and every click refetches the entire admin.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminBoundary>{children}</AdminBoundary>;
}
