"use client";

import { AdminProvider, useAdmin } from "@/lib/admin";
import { AdminLogin } from "../login/login";
import { AdminShell } from "./admin-shell";
import { ModuleGate } from "./module-gate";

/**
 * The client boundary the admin layout mounts.
 *
 * Kept separate from layout.tsx so the layout itself can stay a server
 * component and own the route metadata.
 */
export function AdminBoundary({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <Gate>{children}</Gate>
    </AdminProvider>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAdmin();
  // `ready` false means the session cookie is still being checked. Rendering
  // the login form during that moment would flash it at people who are in
  // fact signed in.
  if (!ready) return <div className="min-h-dvh bg-rail-screen" aria-busy="true" />;
  if (!user) return <AdminLogin />;
  return (
    <AdminShell>
      <ModuleGate>{children}</ModuleGate>
    </AdminShell>
  );
}
