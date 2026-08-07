"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAdmin } from "@/lib/admin";
import { LoadErrorBanner, SaveStatus } from "../save-status";
import { PendingChangesBar } from "../pending-changes-bar";
import { navItemFor } from "../nav";
import { SidebarAccount, SidebarBrand, SidebarNav } from "./sidebar";

/**
 * The frame every admin screen renders inside.
 *
 * Two things changed from the previous version and both matter:
 *
 *   Content is capped at 1440px, not 880. The old cap was narrower than the
 *   tables inside it (900–1040px), so every table in the admin scrolled
 *   sideways and every filter bar wrapped onto three lines.
 *
 *   On phones the rail is a real Sheet. It used to be a hand-rolled
 *   `-translate-x-full` panel with a full-viewport `<button>` as its backdrop
 *   — which announces itself to a screen reader as a button covering the
 *   entire page. The Sheet brings a proper overlay, focus trap and Escape.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { role, viewRole, viewRoleId, setViewRoleId, state, user } = useAdmin();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const current = navItemFor(pathname);

  return (
    <div className="flex min-h-dvh bg-canvas text-zup-body">
      {/* Rail — permanent from lg up */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col bg-rail lg:flex">
        <SidebarBrand />
        <SidebarNav />
        <SidebarAccount />
      </aside>

      {/* Rail — sheet below lg */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-64 bg-rail p-0 lg:hidden">
          <SheetTitle className="sr-only">Admin sections</SheetTitle>
          <div className="flex h-full flex-col">
            <SidebarBrand />
            <SidebarNav onNavigate={() => setMenuOpen(false)} />
            <SidebarAccount />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b border-zup-body/6 bg-white px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-zup-body transition-colors hover:bg-secondary lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>

          <p className="truncate text-ui-lg font-extrabold tracking-[-0.015em]">
            {current?.label ?? "Admin"}
          </p>

          <SaveStatus className="ml-4 hidden sm:flex" />

          <div className="ml-auto flex items-center gap-2.5">
            {role?.id === "super" ? (
              <>
                <span className="hidden text-ui-xs text-zup-soft sm:inline">View as</span>
                <select
                  value={viewRoleId ?? "super"}
                  onChange={(e) =>
                    setViewRoleId(e.target.value === "super" ? null : e.target.value)
                  }
                  aria-label="View as role"
                  className="min-h-9 cursor-pointer rounded-xl border border-zup-body/10 bg-white px-2.5 text-ui-sm font-semibold outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {state.roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id === "super" ? `${user?.name} — ` : ""}
                      {r.name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <span className="rounded-full bg-secondary px-3.5 py-1.5 text-ui-xs font-bold text-zup-gray">
                {viewRole?.name}
              </span>
            )}
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px]">
            <LoadErrorBanner />
            {children}
          </div>
          {/* Mounted once, outside the page container, so every screen shares
              one Save button — staged changes span screens. */}
          <PendingChangesBar />
        </main>
      </div>
    </div>
  );
}
