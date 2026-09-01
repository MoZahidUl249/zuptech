"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Factory,
  FileText,
  Mail,
  PackageX,
  PhoneCall,
  ShoppingBag,
  TrendingDown,
  Truck,
  UserCheck,
} from "lucide-react";
import { useAdmin, type AdminModule } from "@/lib/admin";
import { useInvoices } from "@/lib/admin-invoices";
import { useWarranties } from "@/lib/admin-warranty";

/**
 * "What needs doing right now", as a list of plain sentences.
 *
 * The old Dashboard led with four KPI tiles and a chart — true, but not
 * actionable. Someone opening the admin wants to know what to *do*, so this
 * computes that directly and gives each item a link that lands on the right
 * screen with the right filter already applied. No new endpoints: everything
 * here is derived from data the admin already loaded.
 *
 * Anything a role can't see is dropped, so nobody is nagged about work they
 * have no way to do.
 */

export interface AttentionItem {
  id: string;
  /** A full sentence, not a label. "3 new orders waiting to be confirmed." */
  text: string;
  count: number;
  href: string;
  action: string;
  icon: typeof ShoppingBag;
  /** urgent = money or a customer is waiting; warn = will bite soon. */
  tone: "urgent" | "warn" | "info";
  module: AdminModule;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function useAttention(): AttentionItem[] {
  const { state, can } = useAdmin();
  const { list: invoices } = useInvoices();
  const { list: warranties } = useWarranties();

  const items: AttentionItem[] = [];
  const add = (i: AttentionItem) => {
    if (i.count > 0 && can(i.module) !== "none") items.push(i);
  };

  /* ===== Orders ===== */

  const toConfirm = state.orders.filter((o) => o.status === "Processing");
  add({
    id: "orders-new",
    count: toConfirm.length,
    text: `${toConfirm.length} new ${plural(toConfirm.length, "order is", "orders are")} waiting to be confirmed`,
    href: "/admin/orders?status=Processing",
    action: "Confirm them",
    icon: ShoppingBag,
    tone: "urgent",
    module: "orders",
  });

  /* An order that is confirmed but still sitting here has been promised to a
     customer and handed to nobody. It cannot move any further until someone
     says how it is going out, so it will sit here silently otherwise. Gated on
     `shipping`, because that is who can actually clear it. */
  const awaitingCourier = state.orders.filter((o) => o.status === "Confirmed");
  add({
    id: "orders-awaiting-courier",
    count: awaitingCourier.length,
    text: `${awaitingCourier.length} confirmed ${plural(awaitingCourier.length, "order is", "orders are")} waiting for a courier`,
    href: "/admin/orders?status=Confirmed",
    action: "Hand them over",
    icon: Truck,
    tone: "urgent",
    module: "shipping",
  });

  const unclaimed = state.orders.filter(
    (o) => o.preparedById === null && o.status !== "Cancelled" && o.status !== "Delivered",
  );
  add({
    id: "orders-unclaimed",
    count: unclaimed.length,
    text: `${unclaimed.length} ${plural(unclaimed.length, "order has", "orders have")} nobody looking after ${plural(unclaimed.length, "it", "them")}`,
    href: "/admin/orders?owner=unassigned",
    action: "Assign them",
    icon: UserCheck,
    tone: "warn",
    module: "orders",
  });

  const deliveredNoBill = state.orders.filter((o) => o.status === "Delivered" && !o.invoiceId);
  add({
    id: "orders-no-bill",
    count: deliveredNoBill.length,
    text: `${deliveredNoBill.length} delivered ${plural(deliveredNoBill.length, "order has", "orders have")} no bill yet`,
    href: "/admin/bills?needsBill=1",
    action: "Make bills",
    icon: FileText,
    tone: "warn",
    module: "invoices",
  });

  /* ===== Money ===== */

  const unpaid = invoices.filter((i) => i.status === "Issued");
  const owed = unpaid.reduce((sum, i) => sum + i.total, 0);
  add({
    id: "bills-unpaid",
    count: unpaid.length,
    text: `${unpaid.length} ${plural(unpaid.length, "bill is", "bills are")} sent but not paid — ৳${owed.toLocaleString("en-IN")}`,
    href: "/admin/bills?status=Issued",
    action: "Chase them",
    icon: AlertTriangle,
    tone: "urgent",
    module: "invoices",
  });

  /* ===== Stock ===== */

  const outOfStock = state.products.filter((p) => p.visible && p.stock === 0);
  add({
    id: "stock-out",
    count: outOfStock.length,
    text: `${outOfStock.length} ${plural(outOfStock.length, "product is", "products are")} out of stock but still on the website`,
    href: "/admin/stock?filter=out",
    action: "Restock",
    icon: PackageX,
    tone: "urgent",
    module: "inventory",
  });

  const runningLow = state.products.filter(
    (p) => p.stock > 0 && p.reorderAt > 0 && p.stock <= p.reorderAt,
  );
  add({
    id: "stock-low",
    count: runningLow.length,
    text: `${runningLow.length} ${plural(runningLow.length, "product is", "products are")} running low`,
    href: "/admin/stock?filter=low",
    action: "Order more",
    icon: TrendingDown,
    tone: "warn",
    module: "inventory",
  });

  // A purchase order whose ETA is in the past and which hasn't arrived.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const latePos = state.purchaseOrders.filter((po) => {
    if (po.status !== "Confirmed" && po.status !== "In transit") return false;
    const eta = new Date(po.eta);
    return !Number.isNaN(eta.getTime()) && eta < today;
  });
  add({
    id: "po-late",
    count: latePos.length,
    text: `${latePos.length} stock ${plural(latePos.length, "delivery is", "deliveries are")} overdue`,
    href: "/admin/stock?tab=po",
    action: "Check them",
    icon: Truck,
    tone: "warn",
    module: "inventory",
  });

  /* ===== People asking for things ===== */

  const newLeads = state.leads.filter((l) => l.status === "New");
  add({
    id: "leads-new",
    count: newLeads.length,
    text: `${newLeads.length} new service ${plural(newLeads.length, "request", "requests")} to call back`,
    href: "/admin/requests?status=New",
    action: "Call them",
    icon: PhoneCall,
    tone: "urgent",
    module: "leads",
  });

  const newEnquiries = state.industrialLeads.filter((l) => l.status === "New");
  add({
    id: "enquiries-new",
    count: newEnquiries.length,
    text: `${newEnquiries.length} new business ${plural(newEnquiries.length, "enquiry", "enquiries")}`,
    href: "/admin/enquiries?status=New",
    action: "Read them",
    icon: Factory,
    tone: "urgent",
    module: "leads",
  });

  const unread = state.messages.filter((m) => !m.read);
  add({
    id: "messages-unread",
    count: unread.length,
    text: `${unread.length} contact ${plural(unread.length, "message", "messages")} you haven't read`,
    href: "/admin/requests#messages",
    action: "Read them",
    icon: Mail,
    tone: "info",
    module: "leads",
  });

  /* ===== Warranty ===== */

  const claims = warranties.filter((w) => w.status === "Claimed");
  add({
    id: "warranty-claims",
    count: claims.length,
    text: `${claims.length} warranty ${plural(claims.length, "claim is", "claims are")} open`,
    href: "/admin/warranties?status=Claimed",
    action: "Handle them",
    icon: BadgeCheck,
    tone: "warn",
    module: "warranty",
  });

  // Most pressing first — money and waiting customers above housekeeping.
  const rank = { urgent: 0, warn: 1, info: 2 } as const;
  return items.sort((a, b) => rank[a.tone] - rank[b.tone] || b.count - a.count);
}
