"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import * as api from "@/lib/admin-api";

/* ===== Types ===== */

/**
 * Must stay in step with ADMIN_MODULES in ../../backend/src/lib/rbac.ts — the
 * whole matrix is sent when saving a role, and the backend 400s on any key it
 * doesn't know.
 */
export const ADMIN_MODULES = [
  "dashboard",
  "analytics",
  "orders",
  "invoices",
  "warranty",
  "products",
  "inventory",
  "leads",
  "customers",
  "homepage",
  "sitecontent",
  "payments",
  "staff",
  "landingpages",
] as const;
export type AdminModule = (typeof ADMIN_MODULES)[number];
export type Permission = "none" | "view" | "manage";

export interface Role {
  id: string;
  name: string;
  permissions: Record<AdminModule, Permission>;
  /** Server flags (read-only). */
  isSystem?: boolean;
  staffCount?: number;
}

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  /** Real address password-reset codes go to. "" = none on file, in which
   *  case this member can't self-recover — another admin resets it for them. */
  email: string;
  username: string;
  roleId: string;
  /**
   * Transient, only set when creating/updating a member locally — sent to
   * POST/PATCH /admin/api/staff and never stored or echoed back.
   */
  password?: string;
}

/** A catalog category, as served by GET /admin/api/categories. `section` is
 *  the resolved Section.name — a category lives under exactly one section. */
export interface AdminCategory {
  id: string;
  name: string;
  sectionId: string;
  section: string;
  /** SVG *markup*, not a URL — sanitized server-side. "" = none. */
  svgLogo: string;
}

/** A top-level section with its categories nested (GET /admin/api/sections). */
export interface AdminSection {
  id: string;
  name: string;
  categories: AdminCategory[];
}

/** One "buy N+, save X%" tier. A relation on the backend, not a column. */
export interface QuantityOffer {
  minQty: number;
  percentage: number;
}

/** One "buy N+, X% off delivery" tier — same shape and same replace-all write
 *  semantics as QuantityOffer; 100 means the line ships free. */
export interface FreeDeliveryOffer {
  minQty: number;
  percentage: number;
}

/**
 * Unified product row as served by GET /admin/api/products — storefront
 * fields plus admin/inventory fields. Server-computed fields (featured,
 * available, inStock, lowStock, stockValue, rating, sold) are read-only.
 */
export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  /**
   * Taxonomy is `Section → Category → Product`: a product belongs to exactly
   * one category and reaches its section through it. `categoryId` is the only
   * writable field of the three — `category`/`section` are resolved names the
   * backend sends for display.
   *
   * This replaced the old `cat: "Home"|"Industrial"` + `tags: string[]` pair,
   * which the backend dropped. The admin still declared them, so every render
   * of the products table crashed on `p.tags.length`.
   */
  categoryId: string;
  category: string;
  section: string;
  price: number;
  /** Minimum down payment (% of price) shown on the product page. */
  minDp: number;
  onSale: boolean;
  /** 0–100, only meaningful when onSale is true. */
  salePercentage: number;
  deliveryFeeInsideDhaka: number;
  deliveryFeeOutsideDhaka: number;
  installationFeeInsideDhaka: number;
  installationFeeOutsideDhaka: number;
  /** "Buy N+, save X%" tiers, ordered by minQty ascending. */
  quantityOffers: QuantityOffer[];
  /** "Buy N+, X% off delivery" tiers, ordered by minQty ascending. */
  freeDeliveryOffers: FreeDeliveryOffer[];
  /** 0 = none. Generates warranty records when an order is delivered. */
  warrantyMonths: number;
  rating: number;
  sold: number;
  imgHint: string;
  specs: string[];
  description: string;
  video?: string;
  sku: string;
  cost: number;
  stock: number;
  reserved: number;
  reorderAt: number;
  visible: boolean;
  photos: string[]; // ordered gallery URLs, first is the cover photo
  featured?: boolean;
  /** Server-computed price after salePercentage; read-only. */
  salePrice?: number;
  available?: number;
  inStock?: boolean;
  lowStock?: boolean;
  stockValue?: number;
}

export type OrderStatus =
  | "Processing"
  | "Confirmed"
  | "On the way"
  | "Delivered"
  | "Cancelled";
export const ORDER_STATUSES: OrderStatus[] = [
  "Processing",
  "Confirmed",
  "On the way",
  "Delivered",
  "Cancelled",
];

export interface AdminOrderItem {
  productId: string;
  qty: number;
  unitPrice: number;
  deliveryFee: number;
  installationFee: number;
}

/** Row shape of GET /admin/api/orders (AdminOrderDto). */
export interface AdminOrder {
  id: string;
  customer: string;
  phone: string;
  address: string;
  insideDhaka: boolean;
  items: AdminOrderItem[];
  subtotal: number;
  deliveryFee: number;
  installationFee: number;
  total: number;
  pay: string;
  status: OrderStatus;
  createdAt: string; // ISO
  /** Fulfilment accountability — null until someone claims the order. */
  preparedById: string | null;
  preparedBy: string | null;
  invoiceId: string | null;
  invoiceStatus: InvoiceStatus | null;
  warrantyCount: number;
}

export const ORDER_EVENT_KINDS = [
  "placed",
  "status",
  "prepared-by",
  "invoice",
  "warranty",
  "note",
] as const;
export type OrderEventKind = (typeof ORDER_EVENT_KINDS)[number];

/** One entry in an order's append-only audit trail. */
export interface OrderEvent {
  id: string;
  at: string; // ISO
  kind: OrderEventKind;
  detail: string;
  by: string; // staff username, or "customer"
  byName: string;
}

/** An order line enriched with catalog data (admin detail view only). */
export interface AdminOrderLine extends AdminOrderItem {
  name: string;
  sku: string;
  slug: string;
  lineTotal: number;
}

/** GET /admin/api/orders/:id — one call backs the whole order screen. */
export interface OrderDetail extends Omit<AdminOrder, "items"> {
  items: AdminOrderLine[];
  events: OrderEvent[];
  invoice: Invoice | null;
  warranties: Warranty[];
}

export type InvoiceStatus = "Draft" | "Issued" | "Paid" | "Void";
export const INVOICE_STATUSES: InvoiceStatus[] = ["Draft", "Issued", "Paid", "Void"];

/**
 * Invoices carry no money of their own server-side — the amounts below are
 * copied off the order, which froze them at checkout.
 */
export interface Invoice {
  id: string;
  orderId: string;
  status: InvoiceStatus;
  issuedAt: string | null;
  paidAt: string | null;
  notes: string;
  issuedBy: string | null;
  createdAt: string;
  customer: string;
  phone: string;
  address: string;
  pay: string;
  subtotal: number;
  deliveryFee: number;
  installationFee: number;
  total: number;
  preparedBy: string | null;
  items: AdminOrderLine[];
}

export type WarrantyStatus = "Active" | "Expired" | "Claimed" | "Replaced" | "Void";
export const WARRANTY_STATUSES: WarrantyStatus[] = [
  "Active",
  "Expired",
  "Claimed",
  "Replaced",
  "Void",
];

export interface Warranty {
  id: string;
  orderId: string;
  orderItemId: number;
  productId: string;
  productName: string;
  sku: string;
  qty: number;
  serialNo: string;
  months: number;
  startsAt: string;
  endsAt: string;
  status: WarrantyStatus;
  claimNote: string;
  customer: string;
  phone: string;
}

export type LeadStatus =
  | "New"
  | "Contacted"
  | "Survey booked"
  | "Quoted"
  | "Won"
  | "Lost";
export const LEAD_STATUSES: LeadStatus[] = [
  "New",
  "Contacted",
  "Survey booked",
  "Quoted",
  "Won",
  "Lost",
];

export interface ServiceLead {
  id: string;
  service: string;
  customer: string;
  city: string;
  status: LeadStatus;
  phone?: string;
  notes?: string;
}

/**
 * Industrial enquiries run a longer B2B pipeline than home-service leads, so
 * they carry their own status vocabulary. Keep in step with
 * INDUSTRIAL_LEAD_STATUSES in ../backend/src/lib/rules.ts.
 */
export type IndustrialLeadStatus =
  | "New"
  | "Qualifying"
  | "Site survey"
  | "Proposal sent"
  | "Negotiation"
  | "Won"
  | "Lost";
export const INDUSTRIAL_LEAD_STATUSES: IndustrialLeadStatus[] = [
  "New",
  "Qualifying",
  "Site survey",
  "Proposal sent",
  "Negotiation",
  "Won",
  "Lost",
];

export interface IndustrialLead {
  id: string;
  /** Snapshot of the requested service label; survives a rename/delete. */
  service: string;
  /** null when the enquiry was never linked to an IndustrialService row. */
  serviceId: string | null;
  company: string;
  contactName: string;
  designation: string;
  phone: string;
  email: string;
  sector: string;
  scope: string;
  timeline: string;
  siteLocation: string;
  load: string;
  budget: string;
  notes: string;
  status: IndustrialLeadStatus;
  createdAt: string;
}

export interface AdminCustomer {
  id: string;
  name: string;
  phone: string;
  orders: number;
  joined: string;
}

/** A message sent from the storefront contact form (read-only in admin). */
export interface ContactMessage {
  id: string;
  name: string;
  message: string;
  phone?: string;
  email?: string;
  /** The backend has always returned this and accepted PATCH …/messages/:id
   *  to set it; the admin simply never read it, so every message looked the
   *  same whether or not anyone had dealt with it. */
  read: boolean;
  createdAt: string;
}

/**
 * A home-page banner slide, mirroring what the storefront hero actually
 * renders: a full-bleed image with one CTA button.
 */
export interface HeroSlide {
  id: string;
  image: string | null; // path or uploaded data-URL
  /** Whether `image` is a still or a clip the hero plays inline. */
  mediaType?: "image" | "video";
  cta: string;
  href: string;
  active: boolean;
  fit?: "cover" | "contain";
  bg?: string;
}

/** Admin-editable page copy. A blank string means "use the frontend's
 *  built-in default" — see DEFAULT_COPY / resolveCopy in lib/admin-bridge.ts. */
export interface SiteCopy {
  featuredHeading: string;
  servicesHeading: string;
  servicesSubtitle: string;
  footerDescription: string;

  /* Home page */
  homeHeroEyebrow: string;
  homeHeroHeadline: string;
  homeHeroSubhead: string;
  homeIndustrialEyebrow: string;
  homeIndustrialHeading: string;
  homeCapabilitiesEyebrow: string;
  homeCapabilitiesHeading: string;
  homeCtaHeading: string;
  homeCtaSubtext: string;
  homeCtaButton: string;

  /* Industrial page */
  industrialHeroEyebrow: string;
  industrialHeroHeadline: string;
  industrialHeroSubhead: string;
  industrialGridHeading: string;
  industrialGridBody: string;
  industrialServicesHeading: string;
  industrialServicesSubtitle: string;
  industrialStandardsHeading: string;
  industrialStandardsBody: string;

  /* Contact page */
  contactHeading: string;
  contactFormHeading: string;
  contactOfficeHeading: string;
  contactTeamHeading: string;
  contactServiceLine: string;
  contactTendersEmail: string;
}

/** Contact details shown in the footer, contact page and WhatsApp button. */
export interface SiteContact {
  /** Dialable number, e.g. +8801700000000 */
  phone: string;
  /** Human-readable form, e.g. +880 17 0000 0000 */
  phoneDisplay: string;
  /** Support hotline (shortcode), shown alongside the phone */
  hotline: string;
  email: string;
  /** WhatsApp number as digits only, e.g. 8801700000000 */
  whatsapp: string;
  street: string;
  city: string;
  postalCode: string;
  hours: string;
}

export interface Integrations {
  /** Google Tag Manager container id, e.g. GTM-ABC1234 */
  gtmId: string;
  gtmEnabled: boolean;
}

export const GTM_ID_RE = /^GTM-[A-Z0-9]{4,10}$/;

/* ===== Inventory ===== */

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  items: string;
}

export type PoStatus = "Confirmed" | "In transit" | "Received" | "Cancelled";
export const PO_STATUSES: PoStatus[] = [
  "Confirmed",
  "In transit",
  "Received",
  "Cancelled",
];

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  productId: string;
  qty: number;
  value: number;
  eta: string;
  status: PoStatus;
}

export interface StockMovement {
  id: string;
  date: string;
  sku: string;
  change: number;
  reason: string;
  by: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  kind: "Mobile wallet" | "Card gateway" | "Offline";
  provider: string;
  providers: string[];
  enabled: boolean;
  environment: "Live" | "Test";
  apiKey: string;
  apiSecret: string;
  webhookUrl: string;
  isGateway: boolean;
}

export interface AdminState {
  roles: Role[];
  staff: StaffMember[];
  products: AdminProduct[];
  /** Catalog taxonomy — needed by the product editor's category picker. */
  sections: AdminSection[];
  categories: AdminCategory[];
  /** Storefront product ids shown in the home-page "Featured products" row, in order. */
  featuredIds: string[];
  orders: AdminOrder[];
  leads: ServiceLead[];
  industrialLeads: IndustrialLead[];
  customers: AdminCustomer[];
  messages: ContactMessage[];
  slides: HeroSlide[];
  copy: SiteCopy;
  contact: SiteContact;
  integrations: Integrations;
  payments: PaymentMethod[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  movements: StockMovement[];
}

/**
 * A placeholder id for a row that exists locally but not yet on the server.
 *
 * The diff engine sends the new row to its POST endpoint and then re-fetches
 * the collection (`reload.add(...)` in syncKeys), so this id lives for about a
 * second before the server's real one replaces it. It only has to be unique
 * within the session.
 *
 * A counter rather than `Date.now()`: React's rules forbid impure calls in
 * render, two rows added in the same millisecond would collide, and a
 * timestamp masquerading as an id invites someone to read meaning into it.
 */
let tempSeq = 0;
export const tempId = (prefix: string) => `${prefix}-new-${++tempSeq}`;

export function emptyState(): AdminState {
  return {
    roles: [],
    staff: [],
    products: [],
    sections: [],
    categories: [],
    featuredIds: [],
    orders: [],
    leads: [],
    industrialLeads: [],
    customers: [],
    messages: [],
    slides: [],
    copy: {
      featuredHeading: "",
      servicesHeading: "",
      servicesSubtitle: "",
      footerDescription: "",
      homeHeroEyebrow: "",
      homeHeroHeadline: "",
      homeHeroSubhead: "",
      homeIndustrialEyebrow: "",
      homeIndustrialHeading: "",
      homeCapabilitiesEyebrow: "",
      homeCapabilitiesHeading: "",
      homeCtaHeading: "",
      homeCtaSubtext: "",
      homeCtaButton: "",
      industrialHeroEyebrow: "",
      industrialHeroHeadline: "",
      industrialHeroSubhead: "",
      industrialGridHeading: "",
      industrialGridBody: "",
      industrialServicesHeading: "",
      industrialServicesSubtitle: "",
      industrialStandardsHeading: "",
      industrialStandardsBody: "",
      contactHeading: "",
      contactFormHeading: "",
      contactOfficeHeading: "",
      contactTeamHeading: "",
      contactServiceLine: "",
      contactTendersEmail: "",
    },
    contact: {
      phone: "",
      phoneDisplay: "",
      hotline: "",
      email: "",
      whatsapp: "",
      street: "",
      city: "",
      postalCode: "",
      hours: "",
    },
    integrations: { gtmId: "", gtmEnabled: false },
    payments: [],
    suppliers: [],
    purchaseOrders: [],
    movements: [],
  };
}

/* ===== Formatting ===== */

/** Bangladeshi lakh-style grouping: 918000 -> "9,18,000" */
export function bd(n: number): string {
  const neg = n < 0 ? "-" : "";
  const s = Math.round(Math.abs(n)).toString();
  if (s.length <= 3) return neg + s;
  let out = s.slice(-3);
  let rest = s.slice(0, -3);
  while (rest.length > 2) {
    out = rest.slice(-2) + "," + out;
    rest = rest.slice(0, -2);
  }
  return neg + rest + "," + out;
}

export function taka(n: number): string {
  return "৳ " + bd(n);
}

/** Compact chart label: 97000 -> "97k", 130000 -> "1.3L" */
export function compactBd(n: number): string {
  if (n >= 100000) {
    const l = n / 100000;
    return (l >= 10 ? Math.round(l) : Math.round(l * 10) / 10) + "L";
  }
  if (n >= 1000) return Math.round(n / 1000) + "k";
  return String(n);
}

/* ===== Diff-sync: translate update(patch) into backend calls ===== */

type ReloadKey = keyof typeof api.reloaders;

function diffById<T extends { id: string }>(prev: T[], next: T[]) {
  const prevById = new Map(prev.map((x) => [x.id, x]));
  const nextIds = new Set(next.map((x) => x.id));
  return {
    added: next.filter((x) => !prevById.has(x.id)),
    removed: prev.filter((x) => !nextIds.has(x.id)),
    changed: next.filter((x) => {
      const before = prevById.get(x.id);
      return before && JSON.stringify(before) !== JSON.stringify(x);
    }),
    before: (id: string) => prevById.get(id),
  };
}

/**
 * Push the difference between the last known server state and the local
 * state for the given keys. Returns the collections that must be re-fetched
 * to pick up server-computed fields and server-generated ids.
 */
async function syncKeys(
  keys: Set<keyof AdminState>,
  prev: AdminState,
  next: AdminState,
): Promise<Set<ReloadKey>> {
  const reload = new Set<ReloadKey>();

  if (keys.has("orders")) {
    const { changed, removed } = diffById(prev.orders, next.orders);
    // Status and ownership are separate endpoints, so push only what moved —
    // sending both on every edit would put a spurious entry in the order's
    // audit trail each time someone changed the other field.
    for (const o of changed) {
      const before = prev.orders.find((x) => x.id === o.id);
      if (o.status !== before?.status) await api.setOrderStatus(o.id, o.status);
      if (o.preparedById !== before?.preparedById) {
        await api.setOrderPreparedBy(o.id, o.preparedById);
      }
    }
    for (const o of removed) await api.deleteOrder(o.id);
    reload.add("orders");
    // Deleting an order hands its reserved (or delivered) units back, so the
    // product rows are stale as soon as one goes.
    if (removed.length > 0) reload.add("products");
  }

  if (keys.has("leads")) {
    const { changed } = diffById(prev.leads, next.leads);
    for (const l of changed) await api.setLeadStatus(l.id, l.status);
  }

  if (keys.has("messages")) {
    const { changed } = diffById(prev.messages, next.messages);
    for (const m of changed) await api.setMessageRead(m.id, m.read);
  }

  if (keys.has("industrialLeads")) {
    const { changed, removed } = diffById(prev.industrialLeads, next.industrialLeads);
    for (const l of changed) await api.setIndustrialLeadStatus(l.id, l.status);
    for (const l of removed) await api.deleteIndustrialLead(l.id);
  }

  if (keys.has("featuredIds") && prev.featuredIds.join() !== next.featuredIds.join()) {
    await api.setFeatured(next.featuredIds);
  }

  if (keys.has("slides") && JSON.stringify(prev.slides) !== JSON.stringify(next.slides)) {
    await api.putSlides(next.slides);
    reload.add("slides"); // server assigns slide ids
  }

  if (keys.has("copy") && JSON.stringify(prev.copy) !== JSON.stringify(next.copy)) {
    await api.putCopy(next.copy);
  }
  if (keys.has("contact") && JSON.stringify(prev.contact) !== JSON.stringify(next.contact)) {
    await api.putContact(next.contact);
  }
  if (
    keys.has("integrations") &&
    JSON.stringify(prev.integrations) !== JSON.stringify(next.integrations)
  ) {
    await api.putIntegrations(next.integrations);
  }

  if (keys.has("payments")) {
    const { changed, before } = diffById(prev.payments, next.payments);
    for (const m of changed) {
      const old = before(m.id);
      await api.putPaymentMethod(m.id, {
        name: m.name,
        provider: m.provider,
        enabled: m.enabled,
        environment: m.environment,
        apiKey: m.apiKey,
        webhookUrl: m.webhookUrl,
        // The server returns the secret masked — only write it back when
        // the admin actually typed a new one.
        ...(old && old.apiSecret !== m.apiSecret ? { apiSecret: m.apiSecret } : {}),
      });
    }
  }

  if (keys.has("suppliers")) {
    const { added, removed, changed } = diffById(prev.suppliers, next.suppliers);
    for (const s of added) await api.createSupplier(s);
    for (const s of removed) await api.deleteSupplier(s.id);
    for (const s of changed) await api.patchSupplier(s);
    if (added.length > 0) reload.add("suppliers"); // server-generated ids
  }

  if (keys.has("staff")) {
    const { added, removed, changed } = diffById(prev.staff, next.staff);
    for (const s of added) await api.createStaff(s);
    for (const s of removed) await api.deleteStaff(s.id);
    for (const s of changed) await api.patchStaff(s);
    if (added.length > 0) reload.add("staff");
  }

  if (keys.has("roles")) {
    const { added, removed, changed } = diffById(prev.roles, next.roles);
    for (const r of added) await api.createRole(r);
    for (const r of removed) await api.deleteRole(r.id);
    for (const r of changed) await api.patchRole(r);
    if (added.length > 0) reload.add("roles");
  }

  if (keys.has("products")) {
    const { added, removed, changed, before } = diffById(prev.products, next.products);
    for (const p of added) await api.createProduct(p);
    for (const p of removed) await api.deleteProduct(p.id);
    let stockChanged = false;
    for (const p of changed) {
      const old = before(p.id)!;
      if (p.stock !== old.stock) {
        // Stock goes through the stock endpoint so the server logs a
        // movement; the reason comes from the movement the UI queued.
        const reason =
          next.movements.find((m) => m.sku === p.sku && !prev.movements.some((x) => x.id === m.id))
            ?.reason ?? "Manual stock adjustment";
        await api.adjustStock(p.id, p.stock, reason);
        reload.add("movements");
        stockChanged = true;
      }
      const { stock: _s1, ...restNew } = p;
      const { stock: _s2, ...restOld } = old;
      if (JSON.stringify(restNew) !== JSON.stringify(restOld)) await api.patchProduct(p);
    }
    // Only refetch the whole catalog when server-computed fields could have
    // changed: creates (server assigns id/sku/rating/sold), deletes
    // (featured-list cleanup), or stock edits (available/inStock/lowStock/
    // stockValue). A plain name/price/description patch doesn't touch any
    // of those — reloading for it just replaces the array with a
    // freshly-ordered one mid-edit, which visibly reorders the product's row
    // and re-renders the whole table on every pause while someone is still
    // filling in the form.
    if (added.length > 0 || removed.length > 0 || stockChanged) reload.add("products");
  }

  if (keys.has("purchaseOrders")) {
    const { added, changed } = diffById(prev.purchaseOrders, next.purchaseOrders);
    for (const po of added) {
      await api.createPurchaseOrder({
        supplierId: po.supplierId,
        productId: po.productId,
        qty: po.qty,
      });
    }
    for (const po of changed) {
      if (po.status === "Received") await api.receivePurchaseOrder(po.id);
      else if (po.status === "Cancelled") await api.cancelPurchaseOrder(po.id);
      if (po.status === "Received") {
        reload.add("products");
        reload.add("movements");
      }
    }
    reload.add("purchaseOrders");
  }

  return reload;
}

/* ===== Store (context, backed by /admin/api) =====
 *
 * There are exactly two ways to write to the backend from the admin, and
 * picking the wrong one is how this codebase ended up with three:
 *
 *   Rule A — `update(patch)`. Plain rows with no file uploads, no
 *     server-stamped fields, and no writes the server can legitimately refuse:
 *     orders (status/owner), leads, industrialLeads, featuredIds, slides,
 *     copy, contact, integrations, payments, suppliers, staff, roles,
 *     products, purchaseOrders. Debounced and diffed by `syncKeys` below.
 *
 *   Rule B — a resource hook (useInvoices, useWarranties, useServices,
 *     useLandingPages). Anything with multipart uploads, server-stamped fields
 *     (issuedAt, endsAt), or writes that can 409. These deliberately sit
 *     outside the diff engine, which has no story for any of that.
 *
 *   There is no Rule C. No raw `fetch` in a component.
 */

/** What the debounced save engine is doing, surfaced by <SaveStatus>. The
 *  admin used to have two "Save changes" buttons that only fired a toast,
 *  because nothing told the user their edits were already being saved. */
export interface SyncState {
  state: "idle" | "pending" | "saving" | "saved" | "error";
  /** When the last successful save landed. */
  at: number | null;
  error: string | null;
}

interface AdminContextValue {
  state: AdminState;
  update: (patch: Partial<AdminState>) => void;
  reset: () => void;
  user: StaffMember | null;
  role: Role | null;
  /** Effective role (after "View as"), used for permission checks. */
  viewRole: Role | null;
  viewRoleId: string | null;
  setViewRoleId: (id: string | null) => void;
  can: (module: AdminModule) => Permission;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  ready: boolean;
  /** Save state for the header indicator. */
  sync: SyncState;
  /** Re-run a failed save, keeping whatever is on screen. */
  retrySync: () => void;
  /** Collections that failed to load, shown as a dismissible banner. */
  loadErrors: api.LoadError[];
}

const AdminContext = createContext<AdminContextValue | null>(null);

const SYNC_DEBOUNCE_MS = 700;

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdminState>(emptyState);
  const [me, setMe] = useState<api.AdminMe | null>(null);
  const [viewRoleId, setViewRoleId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Latest local state + last state confirmed by the server, for diffing.
  // Synced in an effect (never during render); flush only runs from the
  // debounce timeout, which always fires after the commit.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const serverRef = useRef<AdminState>(emptyState());
  const dirtyRef = useRef<Set<keyof AdminState>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushingRef = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  // Which collections couldn't be loaded, for the shell's retry banner.
  const [loadErrors, setLoadErrors] = useState<api.LoadError[]>([]);
  // What the debounced save engine is currently doing, so the UI can say so.
  const [sync, setSync] = useState<SyncState>({ state: "idle", at: null, error: null });

  // Loading needs the permission map: most /admin/api endpoints 403 a role
  // without `view` on their module, and asking anyway used to blank the whole
  // admin for every non-super staff member.
  const loadAll = useCallback(async (perms: Record<AdminModule, Permission>) => {
    const { state: loaded, errors } = await api.loadAdminState(perms);
    serverRef.current = loaded;
    dirtyRef.current.clear();
    setState(loaded);
    setLoadErrors(errors);
  }, []);

  // Restore an existing staff session (better-auth cookie).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await api.adminMe();
        if (cancelled) return;
        if (session) {
          setMe(session);
          await loadAll(session.permissions);
        }
      } catch {
        // backend unreachable — login screen will surface it
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  const flush = useCallback(async () => {
    if (flushingRef.current || dirtyRef.current.size === 0) return;
    flushingRef.current = true;
    setSync({ state: "saving", at: null, error: null });
    const keys = dirtyRef.current;
    dirtyRef.current = new Set();
    const prev = serverRef.current;
    const next = stateRef.current;
    let failed = false;
    try {
      const reload = await syncKeys(keys, prev, next);
      // Assume what we pushed is now server truth, then refresh the
      // collections with server-generated ids/computed fields.
      serverRef.current = { ...next };
      if (reload.size > 0) {
        const fresh: Partial<AdminState> = {};
        await Promise.all(
          [...reload].map(async (key) => {
            (fresh as Record<string, unknown>)[key] = await api.reloaders[key]();
          }),
        );
        serverRef.current = { ...serverRef.current, ...fresh };
        // Don't clobber keys the admin dirtied again while we were syncing.
        const safe = Object.fromEntries(
          Object.entries(fresh).filter(([k]) => !dirtyRef.current.has(k as keyof AdminState)),
        ) as Partial<AdminState>;
        setState((s) => ({ ...s, ...safe }));
      }
      setSync({ state: "saved", at: Date.now(), error: null });
    } catch (err) {
      // Deliberately NOT reloading from the server here. That's what this used
      // to do, and it silently replaced whatever the admin had just typed with
      // the last-known-good server copy — losing their work at the exact
      // moment they most needed it kept. Keep local state, put the keys back
      // in the dirty set, and let them retry.
      failed = true;
      for (const key of keys) dirtyRef.current.add(key);
      const message = err instanceof Error ? err.message : "Couldn't save";
      setSync({ state: "error", at: null, error: message });
    } finally {
      flushingRef.current = false;
      // Only auto-continue after a success. Rescheduling after a failure would
      // hammer a down backend forever, since the failed keys go straight back
      // into the dirty set — retrying is the user's call, via retrySync().
      if (!failed && dirtyRef.current.size > 0) {
        // Self-reference goes through the ref so the callback stays memoizable.
        timerRef.current = setTimeout(() => void flushRef.current(), SYNC_DEBOUNCE_MS);
      }
    }
    // No dependencies: everything this touches is a ref or a setter. It used
    // to depend on loadAll, back when a failed save reloaded from the server.
  }, []);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const update = useCallback(
    (patch: Partial<AdminState>) => {
      setState((s) => ({ ...s, ...patch }));
      for (const key of Object.keys(patch)) dirtyRef.current.add(key as keyof AdminState);
      setSync({ state: "pending", at: null, error: null });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), SYNC_DEBOUNCE_MS);
    },
    [flush],
  );

  /** Discard local edits and take the server's copy. */
  const reset = useCallback(() => {
    if (!me) return;
    setSync({ state: "idle", at: null, error: null });
    void loadAll(me.permissions).catch(() =>
      toast.error("Couldn't reload from the server"),
    );
  }, [loadAll, me]);

  /** Retry a save that failed, without losing what's on screen. */
  const retrySync = useCallback(() => {
    if (dirtyRef.current.size === 0) {
      setSync({ state: "idle", at: null, error: null });
      return;
    }
    void flush();
  }, [flush]);

  // Nothing in this app auto-saves on unload, so warn while edits are in
  // flight or queued — a debounced save you navigated away from is a lost one.
  useEffect(() => {
    if (sync.state !== "pending" && sync.state !== "saving" && sync.state !== "error") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [sync.state]);

  const login = useCallback(
    async (username: string, password: string) => {
      const ok = await api.adminLogin(username.trim().toLowerCase(), password);
      if (!ok) return false;
      const session = await api.adminMe();
      if (!session) return false;
      setMe(session);
      setViewRoleId(null);
      // loadAll no longer throws on a partial failure — it reports per-slice
      // errors, which the shell shows as a retry banner over a working admin.
      await loadAll(session.permissions);
      return true;
    },
    [loadAll],
  );

  const logout = useCallback(() => {
    void api.adminLogout().catch(() => undefined);
    setMe(null);
    setViewRoleId(null);
    setState(emptyState());
    serverRef.current = emptyState();
    dirtyRef.current.clear();
    setLoadErrors([]);
    setSync({ state: "idle", at: null, error: null });
  }, []);

  const value = useMemo<AdminContextValue>(() => {
    const user: StaffMember | null = me
      ? {
          id: me.staff.id,
          name: me.staff.name,
          phone: me.staff.phone,
          email: me.staff.email ?? "",
          username: me.staff.username,
          roleId: me.role.id,
        }
      : null;
    const role: Role | null = me
      ? (state.roles.find((r) => r.id === me.role.id) ?? {
          id: me.role.id,
          name: me.role.name,
          permissions: me.permissions,
        })
      : null;
    const viewRole =
      role?.id === "super" && viewRoleId
        ? (state.roles.find((r) => r.id === viewRoleId) ?? role)
        : role;
    const can = (module: AdminModule): Permission => {
      if (!me) return "none";
      const perms = viewRole && viewRole.id !== me.role.id ? viewRole.permissions : me.permissions;
      // The backend now knows every module in ADMIN_MODULES, so a missing key
      // means the role genuinely has no access — no fallbacks.
      return perms[module] ?? "none";
    };
    return {
      state,
      update,
      reset,
      user,
      role,
      viewRole,
      viewRoleId,
      setViewRoleId,
      can,
      login,
      logout,
      ready,
      sync,
      retrySync,
      loadErrors,
    };
  }, [
    state,
    me,
    viewRoleId,
    update,
    reset,
    login,
    logout,
    ready,
    sync,
    retrySync,
    loadErrors,
  ]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminProvider>");
  return ctx;
}
