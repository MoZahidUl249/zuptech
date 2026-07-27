"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  LayoutDashboard,
  ChartLine,
  ShoppingBag,
  FileText,
  BadgeCheck,
  Package,
  Warehouse,
  FolderTree,
  PhoneCall,
  Factory,
  Users,
  House,
  PenLine,
  CreditCard,
  ShieldCheck,
  Megaphone,
  Image as ImageIcon,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminProvider, useAdmin, type AdminModule } from "@/lib/admin";
import { DashboardSection } from "./section-dashboard";
import { AnalyticsSection } from "./section-analytics";
import {
  LeadsSection,
  IndustrialLeadsSection,
  CustomersSection,
} from "./section-tables";
import { OrdersSection } from "./section-orders";
import { InvoicesSection } from "./section-invoices";
import { WarrantySection } from "./section-warranty";
import { ProductsSection, InventorySection } from "./section-products";
import { HomePageSection, SiteContentSection } from "./section-content";
import { PaymentsSection } from "./section-payments";
import { StaffSection } from "./section-staff";
import { LandingPagesSection } from "./section-landing-pages";
import { PageHeroesSection } from "./section-page-heroes";
import { TaxonomySection } from "./section-taxonomy";

/**
 * Sidebar identity. Usually the RBAC module itself, but the two lead screens
 * both gate on "leads" while being separate destinations, so the nav needs a
 * key of its own — `module` stays purely the permission being checked.
 */
type NavKey = AdminModule | "industrialleads" | "pageheroes" | "taxonomy";

const NAV: {
  key: NavKey;
  module: AdminModule;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { key: "dashboard", module: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "analytics", module: "analytics", label: "Analytics", icon: ChartLine },
  { key: "orders", module: "orders", label: "Orders", icon: ShoppingBag },
  { key: "invoices", module: "invoices", label: "Invoices", icon: FileText },
  { key: "warranty", module: "warranty", label: "Warranty", icon: BadgeCheck },
  { key: "products", module: "products", label: "Products", icon: Package },
  { key: "taxonomy", module: "products", label: "Categories", icon: FolderTree },
  { key: "inventory", module: "inventory", label: "Inventory", icon: Warehouse },
  { key: "leads", module: "leads", label: "Service leads", icon: PhoneCall },
  {
    key: "industrialleads",
    module: "leads",
    label: "Industrial leads",
    icon: Factory,
  },
  { key: "customers", module: "customers", label: "Customers", icon: Users },
  { key: "homepage", module: "homepage", label: "Home page", icon: House },
  { key: "landingpages", module: "landingpages", label: "Landing pages", icon: Megaphone },
  { key: "sitecontent", module: "sitecontent", label: "Site content", icon: PenLine },
  { key: "pageheroes", module: "sitecontent", label: "Page heroes", icon: ImageIcon },
  { key: "payments", module: "payments", label: "Payments", icon: CreditCard },
  { key: "staff", module: "staff", label: "Staff & roles", icon: ShieldCheck },
];

// "pricing" has no nav entry of its own (its editor is nested inside the
// Payments section) — Partial here, not Record, reflects that; `current`
// below is always derived from NAV, so the lookup is never actually missing.
const SECTIONS: Partial<Record<NavKey, React.ComponentType>> = {
  dashboard: DashboardSection,
  analytics: AnalyticsSection,
  orders: OrdersSection,
  invoices: InvoicesSection,
  warranty: WarrantySection,
  products: ProductsSection,
  taxonomy: TaxonomySection,
  inventory: InventorySection,
  leads: LeadsSection,
  industrialleads: IndustrialLeadsSection,
  customers: CustomersSection,
  homepage: HomePageSection,
  landingpages: LandingPagesSection,
  sitecontent: SiteContentSection,
  pageheroes: PageHeroesSection,
  payments: PaymentsSection,
  staff: StaffSection,
};

export function AdminApp() {
  return (
    <AdminProvider>
      <Gate />
    </AdminProvider>
  );
}

function Gate() {
  const { user, ready } = useAdmin();
  if (!ready) {
    return <div className="min-h-dvh bg-[#12161d]" aria-busy="true" />;
  }
  return user ? <Shell /> : <Login />;
}

/* ===== Login ===== */

function Login() {
  const { login } = useAdmin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#12161d] px-5 py-10">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          const ok = await login(username, password);
          setBusy(false);
          if (!ok) {
            setError("Wrong username or password. Try the demo accounts below.");
          }
        }}
        className="zup-pop w-full max-w-[340px] rounded-2xl bg-white px-7 py-8 shadow-[0_24px_60px_rgba(0,0,0,.45)]"
      >
        <div className="mb-6 flex items-center gap-2.5">
          <Image
            src="/images/zup-mark.png"
            alt=""
            width={34}
            height={34}
            className="h-8.5 w-8.5"
          />
          <div>
            <p className="text-[15px] font-extrabold leading-tight tracking-[-0.01em] text-zup-body">
              ZUP TECH
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zup-blue">
              Admin access
            </p>
          </div>
        </div>

        <label className="mb-1.5 block text-[13px] font-bold text-zup-body" htmlFor="adm-user">
          Username
        </label>
        <input
          id="adm-user"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setError("");
          }}
          placeholder="username"
          autoComplete="username"
          autoCapitalize="none"
          className="mb-4 min-h-11 w-full rounded-xl border border-zup-body/10 bg-zup-bg px-3.5 text-base outline-none transition-colors placeholder:text-zup-faint focus:border-zup-blue"
        />

        <label className="mb-1.5 block text-[13px] font-bold text-zup-body" htmlFor="adm-pass">
          Password
        </label>
        <input
          id="adm-pass"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          placeholder="••••••"
          autoComplete="current-password"
          className="mb-5 min-h-11 w-full rounded-xl border border-zup-body/10 bg-zup-bg px-3.5 text-base outline-none transition-colors placeholder:text-zup-faint focus:border-zup-blue"
        />

        {error ? (
          <p className="mb-4 text-[13px] font-medium text-[#D32F2F]" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="min-h-12 w-full rounded-full bg-zup-blue text-[15px] font-bold text-white transition-colors hover:bg-zup-blue-dark disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="mt-4 text-center text-xs leading-relaxed text-zup-soft">
          Demo accounts — <b className="text-zup-gray">arif</b> (Super Admin),{" "}
          <b className="text-zup-gray">nusrat</b> (Manager),{" "}
          <b className="text-zup-gray">rakib</b> (Support) · password{" "}
          <b className="text-zup-gray">zup123</b>
        </p>
      </form>
    </main>
  );
}

/* ===== Shell ===== */

function Shell() {
  const { user, role, viewRole, viewRoleId, setViewRoleId, can, state, logout } =
    useAdmin();
  const visibleNav = useMemo(
    () => NAV.filter((n) => can(n.module) !== "none"),
    [can],
  );
  const [active, setActive] = useState<NavKey>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  // If "View as" hides the current section, fall back to the first visible one.
  const current = visibleNav.some((n) => n.key === active)
    ? active
    : (visibleNav[0]?.key ?? "dashboard");
  // Always present: `current` only ever takes a value from NAV, and every
  // NAV module has a SECTIONS entry.
  const Section = SECTIONS[current]!;
  const title = NAV.find((n) => n.key === current)?.label ?? "Dashboard";

  return (
    <div className="flex min-h-dvh bg-[#F2F3F6] text-zup-body">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-56 flex-col bg-[#0F1420] transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
          <Image src="/images/zup-mark.png" alt="" width={30} height={30} className="h-7.5 w-7.5" />
          <div>
            <p className="text-[13.5px] font-extrabold leading-tight tracking-[-0.01em] text-white">
              ZUP TECH
            </p>
            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#8a93a5]">
              Admin
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-[#8a93a5] hover:bg-white/5 lg:hidden"
          >
            <X className="h-4.5 w-4.5" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3" aria-label="Admin sections">
          {visibleNav.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setActive(key);
                setMenuOpen(false);
              }}
              aria-current={key === current ? "page" : undefined}
              className={cn(
                "mb-0.5 flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[13.5px] font-semibold transition-colors",
                key === current
                  ? "bg-[#1D2739] text-white"
                  : "text-[#98A0AD] hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
              {label}
            </button>
          ))}
        </nav>

        <div className="border-t border-white/8 px-5 py-4">
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b7382]">
            Signed in as
          </p>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zup-blue text-sm font-extrabold text-white">
              {user?.name.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-white">{user?.name}</p>
              <p className="truncate text-[11px] text-[#8a93a5]">{role?.name}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-full border border-white/14 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-white/8"
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      {menuOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/45 lg:hidden"
        />
      ) : null}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b border-zup-body/6 bg-white px-4 sm:px-7">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="flex h-10 w-10 items-center justify-center rounded-full text-zup-body hover:bg-secondary lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <h1 className="text-[17px] font-extrabold tracking-[-0.015em]">{title}</h1>

          {role?.id === "super" ? (
            <div className="ml-auto flex items-center gap-2.5">
              <span className="hidden text-xs text-zup-soft sm:inline">View as</span>
              <select
                value={viewRoleId ?? "super"}
                onChange={(e) =>
                  setViewRoleId(e.target.value === "super" ? null : e.target.value)
                }
                aria-label="View as role"
                className="min-h-9 rounded-xl border border-zup-body/10 bg-white px-2.5 text-[13px] font-semibold outline-none focus:border-zup-blue"
              >
                {state.roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id === "super" ? `${user?.name} — ` : ""}
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="ml-auto rounded-full bg-secondary px-3.5 py-1.5 text-xs font-bold text-zup-gray">
              {viewRole?.name}
            </span>
          )}
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-7 sm:py-6">
          <div className="mx-auto w-full max-w-[880px]">
            <Section />
          </div>
        </main>
      </div>
    </div>
  );
}
