import {
  BadgeCheck,
  ChartLine,
  CreditCard,
  Factory,
  FileText,
  FolderTree,
  House,
  Image as ImageIcon,
  LayoutDashboard,
  Megaphone,
  Package,
  PenLine,
  PhoneCall,
  ShieldCheck,
  ShoppingBag,
  Users,
  Warehouse,
  Wrench,
} from "lucide-react";
import type { AdminModule } from "@/lib/admin";

/**
 * Every screen in the admin, in one list.
 *
 * This replaces a hardcoded array of 17 flat entries plus a parallel
 * `SECTIONS` map plus a `NavKey` type that had to invent extra keys for the
 * screens sharing a permission ("industrialleads", "pageheroes", "taxonomy").
 * `module` is now just a field, so a screen and the permission it checks are
 * separate facts and no synthetic key is needed.
 *
 * Two rules for the labels:
 *
 *   Say what the thing is, not what the industry calls it. "Bills", not
 *   "Invoices". "Service requests", not "Leads". Someone who has never seen
 *   this app should be able to guess what's behind each one.
 *
 *   Every item carries `help` — one sentence, shown as the nav tooltip and
 *   again as the page's subtitle. If a screen can't be explained in one
 *   sentence, that's a sign the screen is doing too much.
 */

export interface AdminNavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** The RBAC module actually checked. Several screens share one. */
  module: AdminModule;
  /** Plain-language one-liner: nav tooltip and page subtitle. */
  help: string;
  /** Marks this item current for nested routes (e.g. /admin/orders/ZT-1). */
  matchPrefix?: string;
}

export interface AdminNavGroup {
  id: string;
  /** null renders the group without a heading (the Today entry). */
  label: string | null;
  /** Pins the group to the bottom, visually quieter — settings, not daily work. */
  footer?: boolean;
  items: AdminNavItem[];
}

export const NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "home",
    label: null,
    items: [
      {
        href: "/admin",
        label: "Today",
        icon: LayoutDashboard,
        module: "dashboard",
        help: "What needs doing right now.",
      },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    items: [
      {
        href: "/admin/orders",
        label: "Orders",
        icon: ShoppingBag,
        module: "orders",
        help: "Every order customers have placed, and where each one is up to.",
        matchPrefix: "/admin/orders",
      },
      {
        href: "/admin/bills",
        label: "Bills",
        icon: FileText,
        module: "invoices",
        help: "Invoices you've raised, and which ones are still unpaid.",
        matchPrefix: "/admin/bills",
      },
      {
        href: "/admin/warranties",
        label: "Warranties",
        icon: BadgeCheck,
        module: "warranty",
        help: "What's still under warranty, and any open claims.",
      },
      {
        href: "/admin/reports",
        label: "Reports",
        icon: ChartLine,
        module: "analytics",
        help: "How sales are going, week by week.",
      },
    ],
  },
  {
    id: "products",
    label: "Products",
    items: [
      {
        href: "/admin/products",
        label: "Products",
        icon: Package,
        module: "products",
        help: "Everything you sell — prices, photos and offers.",
        matchPrefix: "/admin/products",
      },
      {
        href: "/admin/categories",
        label: "Categories",
        icon: FolderTree,
        module: "products",
        help: "How products are grouped on the website.",
      },
      {
        href: "/admin/stock",
        label: "Stock",
        icon: Warehouse,
        module: "inventory",
        help: "How many of each product you have, and what's on order.",
      },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      {
        href: "/admin/customers",
        label: "Customers",
        icon: Users,
        module: "customers",
        help: "Everyone who has ordered from you.",
      },
      {
        href: "/admin/requests",
        label: "Service requests",
        icon: PhoneCall,
        module: "leads",
        help: "People asking for a home service visit, and messages from the contact form.",
      },
      {
        href: "/admin/enquiries",
        label: "Business enquiries",
        icon: Factory,
        module: "leads",
        help: "Companies asking about industrial work.",
      },
    ],
  },
  {
    id: "website",
    label: "Website",
    items: [
      {
        href: "/admin/website/home",
        label: "Home page",
        icon: House,
        module: "homepage",
        help: "The banner slideshow and the products shown on the front page.",
      },
      {
        href: "/admin/website/pictures",
        label: "Page pictures",
        icon: ImageIcon,
        module: "sitecontent",
        help: "The big picture at the top of each page.",
      },
      {
        href: "/admin/website/text",
        label: "Text & contact",
        icon: PenLine,
        module: "sitecontent",
        help: "The wording on the website, and your phone number and address.",
      },
      {
        href: "/admin/website/services",
        label: "Services",
        icon: Wrench,
        module: "sitecontent",
        help: "The services you offer, as listed on the site.",
      },
      {
        href: "/admin/website/campaigns",
        label: "Campaign pages",
        icon: Megaphone,
        module: "landingpages",
        help: "One-product pages for ads, not linked from the menu.",
        matchPrefix: "/admin/website/campaigns",
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    footer: true,
    items: [
      {
        href: "/admin/settings/payments",
        label: "Payment",
        icon: CreditCard,
        module: "payments",
        help: "Which ways customers can pay.",
      },
      {
        href: "/admin/settings/staff",
        label: "Team",
        icon: ShieldCheck,
        module: "staff",
        help: "Who can sign in here, and what each of them is allowed to do.",
      },
    ],
  },
];

export const ALL_NAV_ITEMS: AdminNavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** The nav entry a pathname belongs to — longest prefix wins, so
 *  /admin/products/new resolves to Products rather than to Today. */
export function navItemFor(pathname: string): AdminNavItem | null {
  let best: AdminNavItem | null = null;
  for (const item of ALL_NAV_ITEMS) {
    const prefix = item.matchPrefix ?? item.href;
    const hit = pathname === item.href || pathname.startsWith(`${prefix}/`);
    if (hit && (!best || prefix.length > (best.matchPrefix ?? best.href).length)) {
      best = item;
    }
  }
  return best;
}
