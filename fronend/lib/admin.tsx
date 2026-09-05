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
import { ApiRequestError } from "@/lib/api-error";
import { ADMIN_FIELD_LABELS } from "@/lib/admin-fields";

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
  /* See the note in backend rbac.ts: couriers, bookings and rider
     assignment, deliberately separate from `orders`. */
  "shipping",
  /* See the note in backend rbac.ts: SMS credentials and message switches. */
  "messaging",
  "staff",
  /* See the note in backend rbac.ts: narrower than `staff` on purpose. */
  "staffpassword",
  "landingpages",
  /* See the note in backend rbac.ts: correcting a placed order's zone or
     charges, deliberately narrower than `orders`. */
  "orderadjust",
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

/**
 * The status labels the storefront may show on a product card.
 *
 * "" is not "no tag" — it means "derive it", and the server then resolves
 * stock and in-transit purchase orders into one of the other three. Kept as a
 * union rather than a string so the admin cannot send a label the backend DTO
 * will reject.
 */
export const STOCK_TAGS = ["", "Out of stock", "Incoming", "Sold out"] as const;
export type StockTag = (typeof STOCK_TAGS)[number];

/** One "buy N+, take ৳X off each unit" tier. A relation on the backend, not a
 *  column. */
export interface QuantityOffer {
  minQty: number;
  amount: number;
}

/** One "buy N+, take ৳X off delivery" tier — same shape and same replace-all
 *  write semantics as QuantityOffer. An amount at or above the zone fee means
 *  the line ships free. */
export interface FreeDeliveryOffer {
  minQty: number;
  amount: number;
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
  /** Minimum down payment as a whole percent of price (0–100), shown on the
   *  product page. Display-only — nothing charges from it. */
  minDepositPct: number;
  /** Products shown under this one, in this order. Curated: the storefront
   *  renders exactly these and hides the row when empty. */
  recommendedIds: string[];
  onSale: boolean;
  /** The discount the admin types, 0–100. The SOURCE of the sale: the server
   *  resolves it into `salePrice` once, on write. */
  salePct: number;
  /** What the customer pays while on sale, in BDT. Server-computed from
   *  `salePct` and `price` — read-only here, never sent. */
  salePrice: number;
  /** The RESOLVED status label the storefront shows — read-only. Already has
   *  the override and the stock derivation applied. */
  stockTag: string;
  /** The manual override itself, "" = derive it. This is the editable one;
   *  `stockTag` above is what the derivation produced from it. */
  stockTagOverride: StockTag;
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
  /** Where the work is. Was `city`, and was required — see the note on the
   *  column in schema.prisma. */
  address: string;
  status: LeadStatus;
  /* Not optional: the backend always sends these. They were typed optional and
   * rendered nowhere, so a customer's phone number was unreachable from the
   * admin — the detail sheet exists to fix that. */
  phone: string;
  email: string;
  notes: string;
  createdAt: string;
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
  /** Pages this slide appears on. Absent on rows written before per-page
   *  heroes existed, which all belonged to the home carousel. */
  pages?: HeroPage[];
}

/** The pages a hero slide can be assigned to. */
export type HeroPage = "home" | "services" | "industrial";

/** Label for each, for the admin's page picker. */
export const HERO_PAGE_LABELS: Record<HeroPage, string> = {
  home: "Home",
  services: "Services",
  industrial: "Industrial",
};

/** Admin-editable page copy. A blank string means "use the frontend's
 *  built-in default" — see DEFAULT_COPY / resolveCopy in lib/admin-bridge.ts. */
export interface SiteCopy {
  footerDescription: string;

  /* One headline per page. The home and industrial ones are that page's
   * visually-hidden <h1>; the contact one is visible. Everything else that
   * used to live here — eyebrows, subheads, capability bands, CTA strips —
   * went when its section was deleted from the page. */
  homeHeroHeadline: string;
  servicesHeroHeadline: string;
  industrialHeroHeadline: string;

  /* Contact page */
  contactHeading: string;
  contactFormHeading: string;
  contactOfficeHeading: string;
  contactServiceLine: string;
  contactTendersEmail: string;
}

/** Contact details shown in the footer, contact page and WhatsApp button. */
export interface SiteContact {
  /** Dialable number, e.g. +8801700000000 */
  phone: string;
  /** Human-readable form, e.g. +880 17 0000 0000 */
  phoneDisplay: string;
  /** Support hotline. Printed on invoices only — it is not shown on the site. */
  hotline: string;
  email: string;
  /** WhatsApp number as digits only, e.g. 8801700000000 */
  whatsapp: string;
  street: string;
  city: string;
  postalCode: string;
  hours: string;
  /* The contact page's office card. These were hardcoded placeholders in the
   * frontend until the site-content cleanup wired them through. */
  officeName: string;
  warehouseName: string;
  warehouseAddress: string;
  hoursWeekday: string;
  hoursWeekend: string;
  hoursEmergency: string;
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
  /**
   * Provider credentials that do not fit apiKey/apiSecret — EPS needs five.
   * Arrives masked, exactly like the two above: a key being present means the
   * field is configured, and the value shown is never the real one.
   */
  credentials?: Record<string, string>;
  webhookUrl: string;
  isGateway: boolean;
}

/**
 * Who carries a parcel.
 *
 * `kind` is what decides how much of a shipment is automated: `self` is our
 * own rider and `manual` a courier we have no integration with — both are
 * moved by hand — while `api` books and tracks over the courier's API.
 */
export interface Courier {
  id: string;
  name: string;
  kind: "self" | "api" | "manual";
  provider: string;
  enabled: boolean;
  environment: "Live" | "Test";
  /** Masked on arrival, exactly like payment credentials. */
  credentials?: Record<string, string>;
  /** The provider's API address. Blank for couriers that call nobody. */
  baseUrl: string;
  /** `{code}` is replaced with the tracking code. "" = no tracking page. */
  trackingUrl: string;
  /** Shipments already booked — the server refuses deletion when nonzero. */
  shipmentCount?: number;
}

/**
 * SMS provider settings and which messages go out.
 *
 * `username` and `apiKey` arrive masked; leaving them untouched keeps the
 * stored value. Every toggle costs money per send when it is on.
 */
export interface SmsSettings {
  enabled: boolean;
  provider: string;
  username: string;
  apiKey: string;
  senderId: string;
  baseUrl: string;
  otpEnabled: boolean;
  placedEnabled: boolean;
  shippedEnabled: boolean;
  deliveredEnabled: boolean;
}

/**
 * What an integrated courier needs configured, as declared by the backend.
 *
 * Served rather than duplicated here on purpose: the adapter reads credentials
 * by these keys, so a copy that drifts produces a courier that looks set up and
 * refuses every booking.
 */
export interface CourierProvider {
  id: string;
  label: string;
  defaultBaseUrl: string;
  environmentNote: string;
  fields: { key: string; label: string; help: string; secret: boolean }[];
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
  /** The home page's second product row, above the booking forms. Separate
   *  list from featuredIds so the two rows can show different things. */
  homeRowIds: string[];
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
  couriers: Courier[];
  courierProviders: CourierProvider[];
  sms: SmsSettings;
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

/**
 * True while a row exists only locally.
 *
 * Saves are explicit, so a staged row can sit on screen indefinitely. Anything
 * that posts an id to the server — the purchase-order form, the reorder dialog,
 * the campaign page's product picker — has to leave these out, or the request
 * carries an id the server has never seen.
 */
export const isUnsaved = (row: { id: string }) => row.id.includes("-new-");

export function emptyState(): AdminState {
  return {
    roles: [],
    staff: [],
    products: [],
    sections: [],
    categories: [],
    featuredIds: [],
    homeRowIds: [],
    orders: [],
    leads: [],
    industrialLeads: [],
    customers: [],
    messages: [],
    slides: [],
    copy: {
      footerDescription: "",
      homeHeroHeadline: "",
      servicesHeroHeadline: "",
      industrialHeroHeadline: "",
      contactHeading: "",
      contactFormHeading: "",
      contactOfficeHeading: "",
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
      officeName: "",
      warehouseName: "",
      warehouseAddress: "",
      hoursWeekday: "",
      hoursWeekend: "",
      hoursEmergency: "",
    },
    integrations: { gtmId: "", gtmEnabled: false },
    payments: [],
    couriers: [],
    courierProviders: [],
    sms: {
      enabled: false,
      provider: "mimsms",
      username: "",
      apiKey: "",
      senderId: "",
      baseUrl: "https://api.mimsms.com",
      otpEnabled: true,
      placedEnabled: true,
      shippedEnabled: true,
      deliveredEnabled: false,
    },
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

/**
 * What the Save bar should say when a write is refused.
 *
 * A 422 from an admin route carries only "Invalid request" in `message` — the
 * property that failed and why are in `detail`, which `ApiRequestError`
 * already parses and which nothing ever read. On screens that PUT a whole
 * document (site copy, contact details) that was actively harmful: one
 * out-of-range value blocked every other field on the page and the bar would
 * not say which one, so there was nothing to act on.
 *
 * `ADMIN_FIELD_LABELS` maps the DTO's property names onto the labels printed
 * above the inputs, so the message names the box on screen. Anything not in
 * the map is humanised from the key rather than dropped.
 */
export function saveErrorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) {
    const named = err.fieldMessage((p) => ADMIN_FIELD_LABELS[p]);
    if (named) return named;
  }
  return err instanceof Error ? err.message : "Couldn't save";
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
 * Push the difference between the last known server state and the local state
 * for the given keys.
 *
 * Each key's writes run in isolation. That matters because this is not one
 * transaction: if `suppliers` succeeds and `purchaseOrders` then fails, the
 * supplier is already created, and re-dirtying everything (which is what this
 * used to do) meant the next Save created a second one. Only the keys that
 * actually failed go back in the dirty set.
 *
 * Returns the collections that must be re-fetched to pick up server-computed
 * fields and server-generated ids, plus whatever failed.
 */
async function syncKeys(
  keys: Set<keyof AdminState>,
  prev: AdminState,
  next: AdminState,
): Promise<{ reload: Set<ReloadKey>; failed: Set<keyof AdminState>; error: unknown }> {
  const reload = new Set<ReloadKey>();
  const failed = new Set<keyof AdminState>();
  let error: unknown = null;

  const run = async (key: keyof AdminState, fn: () => Promise<void>) => {
    if (!keys.has(key)) return;
    try {
      await fn();
    } catch (e) {
      failed.add(key);
      error ??= e;
    }
  };

  await run("orders", async () => {
    const { changed, removed } = diffById(prev.orders, next.orders);
    /* Ownership only. Status used to be editable here too, from a dropdown
       in the list; it now moves exclusively through the guided flow on the
       order detail, which calls its endpoints directly rather than going
       through the draft. A status branch left here would be a second, unguarded
       way to move an order — the exact thing that flow exists to remove. */
    for (const o of changed) {
      const before = prev.orders.find((x) => x.id === o.id);
      if (o.preparedById !== before?.preparedById) {
        await api.setOrderPreparedBy(o.id, o.preparedById);
      }
    }
    for (const o of removed) await api.deleteOrder(o.id);
    reload.add("orders");
    // Deleting an order hands its reserved (or delivered) units back, so the
    // product rows are stale as soon as one goes.
    if (removed.length > 0) reload.add("products");
  });

  await run("leads", async () => {
    const { changed } = diffById(prev.leads, next.leads);
    for (const l of changed) await api.setLeadStatus(l.id, l.status);
  });

  await run("messages", async () => {
    const { changed } = diffById(prev.messages, next.messages);
    for (const m of changed) await api.setMessageRead(m.id, m.read);
  });

  await run("industrialLeads", async () => {
    const { changed, removed } = diffById(prev.industrialLeads, next.industrialLeads);
    for (const l of changed) await api.setIndustrialLeadStatus(l.id, l.status);
    for (const l of removed) await api.deleteIndustrialLead(l.id);
  });

  await run("featuredIds", async () => {
    if (prev.featuredIds.join() === next.featuredIds.join()) return;
    await api.setFeatured(next.featuredIds);
  });

  await run("homeRowIds", async () => {
    if (prev.homeRowIds.join() === next.homeRowIds.join()) return;
    await api.setHomeRow(next.homeRowIds);
  });

  await run("slides", async () => {
    if (JSON.stringify(prev.slides) === JSON.stringify(next.slides)) return;
    await api.putSlides(next.slides);
    reload.add("slides"); // server assigns slide ids
  });

  await run("copy", async () => {
    if (JSON.stringify(prev.copy) === JSON.stringify(next.copy)) return;
    await api.putCopy(next.copy);
  });
  await run("contact", async () => {
    if (JSON.stringify(prev.contact) === JSON.stringify(next.contact)) return;
    await api.putContact(next.contact);
  });
  await run("integrations", async () => {
    if (JSON.stringify(prev.integrations) === JSON.stringify(next.integrations)) return;
    await api.putIntegrations(next.integrations);
  });

  await run("payments", async () => {
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
        /* Same rule for the provider credential bag, and the server merges it
           key by key: a field still holding its mask is skipped there, so
           sending the whole object cannot overwrite the four the admin did not
           touch with asterisks. */
        ...(old && JSON.stringify(old.credentials ?? {}) !== JSON.stringify(m.credentials ?? {})
          ? { credentials: m.credentials }
          : {}),
      });
    }
  });

  await run("couriers", async () => {
    const { added, removed, changed, before } = diffById(prev.couriers, next.couriers);
    for (const c of added) await api.createCourier(c);
    for (const c of removed) await api.deleteCourier(c.id);
    for (const c of changed) {
      const old = before(c.id);
      await api.putCourier(c.id, {
        name: c.name,
        kind: c.kind,
        provider: c.provider,
        enabled: c.enabled,
        environment: c.environment,
        baseUrl: c.baseUrl,
        trackingUrl: c.trackingUrl,
        /* Merged key by key on the server, so sending the bag cannot replace
           an untouched credential with the mask it arrived as. */
        ...(old && JSON.stringify(old.credentials ?? {}) !== JSON.stringify(c.credentials ?? {})
          ? { credentials: c.credentials }
          : {}),
      });
    }
    if (added.length > 0) reload.add("couriers");
  });

  await run("sms", async () => {
    if (JSON.stringify(prev.sms) === JSON.stringify(next.sms)) return;
    /* The masked credentials round-trip unchanged unless retyped; the server
       treats a mask as "keep stored", so sending the object whole is safe. */
    await api.putSmsSettings(next.sms);
  });

  await run("suppliers", async () => {
    const { added, removed, changed } = diffById(prev.suppliers, next.suppliers);
    for (const s of added) await api.createSupplier(s);
    for (const s of removed) await api.deleteSupplier(s.id);
    for (const s of changed) await api.patchSupplier(s);
    if (added.length > 0) reload.add("suppliers"); // server-generated ids
  });

  await run("staff", async () => {
    const { added, removed, changed } = diffById(prev.staff, next.staff);
    for (const s of added) await api.createStaff(s);
    for (const s of removed) await api.deleteStaff(s.id);
    for (const s of changed) await api.patchStaff(s);
    if (added.length > 0) reload.add("staff");
  });

  await run("roles", async () => {
    const { added, removed, changed } = diffById(prev.roles, next.roles);
    for (const r of added) await api.createRole(r);
    for (const r of removed) await api.deleteRole(r.id);
    for (const r of changed) await api.patchRole(r);
    if (added.length > 0) reload.add("roles");
  });

  await run("products", async () => {
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
  });

  await run("purchaseOrders", async () => {
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
  });

  return { reload, failed, error };
}

/* ===== Store (context, backed by /admin/api) =====
 *
 * There are three ways to write to the backend from the admin. Picking the
 * wrong one is how this codebase once ended up with nine:
 *
 *   Rule A — `update(patch)`. Plain rows with no file uploads, no
 *     server-stamped fields, and no writes the server can legitimately refuse:
 *     orders (status/owner), leads, industrialLeads, featuredIds, slides,
 *     copy, contact, integrations, payments, suppliers, staff, roles,
 *     product *edits*, purchaseOrders. Staged locally and diffed by `syncKeys`
 *     when the Save button calls `commit()`.
 *
 *   Rule B — a resource hook (useInvoices, useWarranties, useServices,
 *     useTeam, useLandingPages). Anything with multipart uploads,
 *     server-stamped fields (issuedAt, endsAt), or writes that can 409. These
 *     deliberately sit outside the diff engine, which has no story for any of
 *     that. The button that triggers one IS the confirmation.
 *
 *   Rule C — create server-first, then `adopt(patch)`. For a row that must
 *     exist on the server before the rest of the interaction can continue:
 *     product creation, which needs an id before a photo can be attached to
 *     it. `adopt` writes the returned row into both the local state and the
 *     server copy, so the next diff sees nothing to send. Never call `update`
 *     with a row the server already has — that is how you get it created
 *     twice.
 *
 * No raw `fetch` in a component in any of the three.
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
  /** How many collections have staged changes. 0 means everything is saved. */
  pending: number;
  /** Send every staged change. Wired to the Save button. */
  commit: () => Promise<void>;
  /**
   * Take a row the server has already created and treat it as truth.
   *
   * The counterpart to `update()`: it writes to both the local state and the
   * last-known-server copy, and leaves the dirty set alone. Without it, a row
   * created outside this engine (see Rule C) looks like an unsent addition to
   * the next diff, and the next Save creates it a second time.
   */
  adopt: (patch: Partial<AdminState>) => void;
  /** Collections that failed to load, shown as a dismissible banner. */
  loadErrors: api.LoadError[];
}

const AdminContext = createContext<AdminContextValue | null>(null);

/** How long a save may hang before it is abandoned and made retryable. */
const SAVE_TIMEOUT_MS = 20_000;

/** Thrown by the deadline in `commit()` so the message can name the cause. */
class SaveTimeout extends Error {
  constructor() {
    super("save timed out");
    this.name = "SaveTimeout";
  }
}

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
  const flushingRef = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  // Which collections couldn't be loaded, for the shell's retry banner.
  const [loadErrors, setLoadErrors] = useState<api.LoadError[]>([]);
  // What the save engine is currently doing, so the UI can say so.
  const [sync, setSync] = useState<SyncState>({ state: "idle", at: null, error: null });
  // How many collections have staged, unsaved changes. Mirrors dirtyRef, which
  // is a ref and so can't drive a render on its own.
  const [pending, setPending] = useState(0);

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

  /**
   * Push every pending change. Only ever called from the Save button — this
   * used to run on a 700 ms debounce after each keystroke, which meant a
   * half-typed API secret was PUT to the server and a role rename fired a
   * request per character.
   */
  const commit = useCallback(async () => {
    if (flushingRef.current || dirtyRef.current.size === 0) return;
    flushingRef.current = true;
    setSync({ state: "saving", at: null, error: null });
    const keys = dirtyRef.current;
    dirtyRef.current = new Set();
    const prev = serverRef.current;
    const next = stateRef.current;
    try {
      /*
       * Race the sync against a deadline.
       *
       * Without this, a request that never settles wedges the admin for good:
       * `flushingRef` only clears in the `finally` below, and Next's dev proxy
       * has no timeout against a dead upstream — so a save attempted while the
       * backend was down left every later Save a silent no-op, with the button
       * still enabled and nothing reported. A reload was the only way out, and
       * it discarded the staged work.
       */
      const { reload, failed, error } = await Promise.race([
        syncKeys(keys, prev, next),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new SaveTimeout()), SAVE_TIMEOUT_MS),
        ),
      ]);

      // Whatever succeeded is server truth now. Anything that failed goes back
      // in the dirty set — and *only* that, so retrying can't replay a write
      // that already landed.
      const landed = { ...next };
      for (const key of failed) {
        dirtyRef.current.add(key);
        (landed as Record<string, unknown>)[key] = (prev as unknown as Record<string, unknown>)[key];
      }
      serverRef.current = landed;

      if (reload.size > 0) {
        const fresh: Partial<AdminState> = {};
        await Promise.all(
          [...reload].map(async (key) => {
            (fresh as Record<string, unknown>)[key] = await api.reloaders[key]();
          }),
        );
        serverRef.current = { ...serverRef.current, ...fresh };
        // Don't clobber keys the admin dirtied again while we were saving.
        const safe = Object.fromEntries(
          Object.entries(fresh).filter(([k]) => !dirtyRef.current.has(k as keyof AdminState)),
        ) as Partial<AdminState>;
        setState((s) => ({ ...s, ...safe }));
      }

      if (failed.size > 0) {
        // Local state is deliberately kept: replacing what someone just typed
        // with the server's copy loses their work at the exact moment they
        // most need it kept.
        setSync({ state: "error", at: null, error: saveErrorMessage(error) });
      } else {
        setSync({ state: "saved", at: Date.now(), error: null });
      }
    } catch (err) {
      // Either the deadline passed or the post-save reload failed. Put every
      // key back so the retry is a complete one; the writes are PUT/PATCH
      // shaped and idempotent, and the one create path that isn't — products —
      // no longer goes through this engine at all.
      for (const key of keys) dirtyRef.current.add(key);
      const message =
        err instanceof SaveTimeout
          ? "The server didn't respond — nothing was saved. Check the connection and try again."
          : saveErrorMessage(err);
      setSync({ state: "error", at: null, error: message });
    } finally {
      flushingRef.current = false;
      setPending(dirtyRef.current.size);
    }
    // No dependencies: everything this touches is a ref or a setter.
  }, []);
  useEffect(() => {
    flushRef.current = commit;
  }, [commit]);

  /**
   * Stage a change. Nothing is sent — `commit()` does that, from the Save
   * button in the pending-changes bar.
   */
  const update = useCallback((patch: Partial<AdminState>) => {
    setState((s) => ({ ...s, ...patch }));
    for (const key of Object.keys(patch)) dirtyRef.current.add(key as keyof AdminState);
    setPending(dirtyRef.current.size);
    setSync({ state: "pending", at: null, error: null });
  }, []);

  const adopt = useCallback((patch: Partial<AdminState>) => {
    setState((s) => ({ ...s, ...patch }));
    serverRef.current = { ...serverRef.current, ...patch };
    // Deliberately no dirtyRef write: this is already on the server.
  }, []);

  /** Discard local edits and take the server's copy. */
  const reset = useCallback(() => {
    if (!me) return;
    dirtyRef.current = new Set();
    setPending(0);
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
    void commit();
  }, [commit]);

  // Saves are explicit now, so leaving with staged changes loses them outright.
  // Keyed on the pending count rather than sync.state: with autosave gone the
  // state sits at "pending" forever and "idle" never means "nothing staged".
  useEffect(() => {
    if (pending === 0 && sync.state !== "saving" && sync.state !== "error") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending, sync.state]);

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
      pending,
      commit,
      adopt,
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
    pending,
    commit,
    adopt,
    loadErrors,
  ]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminProvider>");
  return ctx;
}
