"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdmin } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, navItemFor, navItemModules } from "../nav";

/**
 * The navigation rail.
 *
 * Seventeen flat entries became four task groups plus a settings shelf. Flat
 * lists make you read all seventeen labels to find one thing; grouped by what
 * you're trying to do ("Sales", "Products", "People", "Website"), you read one
 * heading and then three or four.
 *
 * A group only appears if the signed-in role can open at least one thing in
 * it, so a Support user sees Sales and People and nothing else — a short, true
 * list rather than an arbitrary subset of a long one.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useAdmin();
  const pathname = usePathname();
  const current = navItemFor(pathname);

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => navItemModules(i).some((m) => can(m) !== "none")),
  })).filter((g) => g.items.length > 0);

  return (
    <nav className="flex flex-1 flex-col overflow-y-auto px-3 pb-2" aria-label="Admin sections">
      {groups.map((group) => (
        <div key={group.id} className={cn(group.footer && "mt-auto border-t border-white/8 pt-3")}>
          {group.label ? (
            <p className="mt-4 mb-1 px-3.5 text-ui-micro font-bold uppercase tracking-[0.16em] text-rail-dim">
              {group.label}
            </p>
          ) : null}
          {group.items.map((item) => {
            const active = current?.href === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.help}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "mb-0.5 flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-ui-sm font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-white/30",
                  active
                    ? "bg-rail-active text-white"
                    : "text-rail-fg hover:bg-white/5 hover:text-white",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function SidebarBrand({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 px-5 pt-6 pb-1">
      <Image src="/images/zup-mark.png" alt="" width={30} height={30} className="h-7.5 w-7.5" />
      <div>
        <p className="text-ui-sm font-extrabold leading-tight tracking-[-0.01em] text-white">
          ZUP TECH
        </p>
        <p className="text-ui-micro font-bold uppercase tracking-[0.24em] text-rail-muted">
          Admin
        </p>
      </div>
      {children}
    </div>
  );
}

export function SidebarAccount() {
  const { user, role, logout } = useAdmin();
  return (
    <div className="border-t border-white/8 px-5 py-4">
      <p className="mb-2.5 text-ui-micro font-bold uppercase tracking-[0.16em] text-rail-dim">
        Signed in as
      </p>
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zup-blue text-ui-base font-extrabold text-white">
          {user?.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-ui-sm font-bold text-white">{user?.name}</p>
          <p className="truncate text-ui-micro text-rail-muted">{role?.name}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="cursor-pointer rounded-full border border-white/14 px-3 py-1.5 text-ui-micro font-bold text-white transition-colors hover:bg-white/8"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
