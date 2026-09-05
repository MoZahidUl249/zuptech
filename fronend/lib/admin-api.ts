"use client";

import { useCallback, useEffect, useState } from "react";
import { unwrap } from "@/lib/admin-http";
import { api } from "@/lib/eden";
import { emptyState, STOCK_TAGS } from "@/lib/admin";
import { whole } from "@/lib/utils";
import type { ServiceBulletStyle, ServiceImageSide } from "@/lib/api";
import type {
  AdminModule,
  AdminProduct,
  AdminState,
  Courier,
  HeroSlide,
  Integrations,
  IndustrialLeadStatus,
  LeadStatus,
  OrderStatus,
  PaymentMethod,
  Permission,
  Role,
  SiteContact,
  SmsSettings,
  SiteCopy,
  StaffMember,
  StockTag,
  Supplier,
} from "@/lib/admin";

/*
 * Typed client for the backend's /admin/api endpoints (contract:
 * openapi.json). All calls are same-origin — next.config.ts proxies them to
 * the backend, so the better-auth staff session cookie applies.
 */



/* ===== Auth / session ===== */

export interface AdminMe {
  staff: { id: string; name: string; username: string; phone: string; email: string };
  role: { id: string; name: string; isSystem?: boolean };
  permissions: Record<AdminModule, Permission>;
}

export async function adminLogin(username: string, password: string): Promise<boolean> {
  const res = await fetch("/admin/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return res.ok;
}

/**
 * Set another staff member's password.
 *
 * Staff self-service reset is gone — see routes/admin/auth.ts. Needs
 * `staff: manage`, and the server refuses a Super Admin target unless the
 * caller is one.
 */
export const setStaffPassword = (id: string, password: string) =>
  unwrap(
    api.admin.api.staff({ id }).password.post({ password }),
    "POST /admin/api/staff/:id/password",
  );

export async function adminLogout(): Promise<void> {
  await fetch("/admin/api/logout", { method: "POST" });
}

export async function adminMe(): Promise<AdminMe | null> {
  const res = await fetch("/admin/api/me");
  if (!res.ok) return null;
  return res.json();
}

/* ===== State loading ===== */

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })} ${d.getFullYear()}`;
}

function shortDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Backend product → editor shape (drops any blank photo entries).
 *
 * `get<T>` is an unchecked cast at the fetch boundary, so a field the backend
 * stops sending arrives as `undefined` with no type error — that is exactly
 * how the admin products table came to crash on `p.tags.length`. Every array
 * the UI maps or measures is defaulted here so a shape change degrades to an
 * empty list instead of a render crash.
 */
export function toAdminProduct(
  p: Omit<AdminProduct, "stockTagOverride"> & {
    photos?: (string | null)[];
    stockTagOverride?: string;
  },
): AdminProduct {
  return {
    ...p,
    // Narrowed at the boundary rather than cast: the backend types this as a
    // plain string, and an unrecognised label would otherwise flow into a
    // <select> that has no matching option and silently render as blank.
    // Anything unknown falls back to "derive it", which is the safe default.
    stockTagOverride: STOCK_TAGS.includes(p.stockTagOverride as StockTag)
      ? (p.stockTagOverride as StockTag)
      : "",
    photos: (p.photos ?? []).filter((x): x is string => Boolean(x)),
    specs: p.specs ?? [],
    quantityOffers: p.quantityOffers ?? [],
    freeDeliveryOffers: p.freeDeliveryOffers ?? [],
    categoryId: p.categoryId ?? "",
    category: p.category ?? "",
    section: p.section ?? "",
  };
}

interface PublicSiteConfig {
  featuredIds: string[];
  homeRowIds: string[];
  copy: SiteCopy;
  contact: SiteContact;
  gtm: string | { id: string } | null;
}

/** One collection that couldn't be loaded, surfaced in the shell as a banner
 *  rather than silently blanking the screen. */
export interface LoadError {
  label: string;
  message: string;
}

export interface LoadResult {
  state: AdminState;
  errors: LoadError[];
}

/**
 * Assemble the whole admin state from the backend's granular endpoints.
 *
 * Two rules, both learned the hard way:
 *
 * 1. **Don't request what this role can't have.** Most of these endpoints are
 *    RBAC-gated and answer 403 to a role without `view` on their module. The
 *    seeded Manager has `staff: none` and Support has seven modules at `none`,
 *    so an unconditional fetch of all sixteen guaranteed several 403s.
 *
 * 2. **One failure must not empty the admin.** These used to run under a
 *    single `Promise.all`, so the first 403 rejected the lot, `loadAll()`
 *    threw, and state stayed at `emptyState()` — every non-super staff member
 *    saw a completely blank admin with "0 of 0 orders" on a role that had
 *    `orders: manage`. `allSettled` means a broken Stock endpoint costs Stock,
 *    not the whole panel.
 */
export async function loadAdminState(
  perms: Record<AdminModule, Permission>,
): Promise<LoadResult> {
  const errors: LoadError[] = [];

  /** Fetch only if the role can see the module; fall back to `empty` on 403
   *  or failure, recording anything that wasn't simply "not allowed". */
  const slice = async <T,>(
    module: AdminModule | null,
    label: string,
    fetcher: () => Promise<T>,
    empty: T,
  ): Promise<T> => {
    if (module && perms[module] === "none") return empty;
    try {
      return await fetcher();
    } catch (err) {
      errors.push({
        label,
        message: err instanceof Error ? err.message : "Request failed",
      });
      return empty;
    }
  };

  const [
    roles,
    staff,
    products,
    sections,
    categories,
    orders,
    leads,
    industrialLeads,
    customers,
    slides,
    payments,
    couriers,
    courierProviders,
    sms,
    suppliers,
    purchaseOrders,
    movements,
    messages,
    config,
  ] = await Promise.all([
    slice("staff", "Staff roles", () => unwrap(api.admin.api.roles.get(), "GET /admin/api/roles"), []),
    slice("staff", "Staff", () => unwrap(api.admin.api.staff.get(), "GET /admin/api/staff"), []),
    slice("products", "Products", () => unwrap(api.admin.api.products.get(), "GET /admin/api/products"), []),
    slice("products", "Sections", () => unwrap(api.admin.api.sections.get(), "GET /admin/api/sections"), []),
    slice("products", "Categories", () => unwrap(api.admin.api.categories.get(), "GET /admin/api/categories"), []),
    slice("orders", "Orders", () => unwrap(api.admin.api.orders.get(), "GET /admin/api/orders"), []),
    slice("leads", "Service requests", () => unwrap(api.admin.api.leads.get(), "GET /admin/api/leads"), []),
    slice(
      "leads",
      "Business enquiries",
      () => unwrap(api.admin.api["industrial-leads"].get(), "GET /admin/api/industrial-leads"),
      [],
    ),
    slice(
      "customers",
      "Customers",
      () => unwrap(api.admin.api.customers.get(), "GET /admin/api/customers"),
      [],
    ),
    slice("homepage", "Home page", () => unwrap(api.admin.api.slides.get(), "GET /admin/api/slides"), []),
    slice(
      "payments",
      "Payment methods",
      () => unwrap(api.admin.api["payment-methods"].get(), "GET /admin/api/payment-methods"),
      [],
    ),
    slice("shipping", "Couriers", () => unwrap(api.admin.api.couriers.get(), "GET /admin/api/couriers"), []),
    slice(
      "shipping",
      "Courier providers",
      () => unwrap(api.admin.api["courier-providers"].get(), "GET /admin/api/courier-providers"),
      [],
    ),
    slice(
      "messaging",
      "Text messages",
      () => unwrap(api.admin.api["sms-settings"].get(), "GET /admin/api/sms-settings"),
      emptyState().sms,
    ),
    slice("inventory", "Suppliers", () => unwrap(api.admin.api.suppliers.get(), "GET /admin/api/suppliers"), []),
    slice(
      "inventory",
      "Purchase orders",
      () => unwrap(api.admin.api["purchase-orders"].get(), "GET /admin/api/purchase-orders"),
      [],
    ),
    slice(
      "inventory",
      "Stock movements",
      () => unwrap(api.admin.api.movements.get(), "GET /admin/api/movements"),
      [],
    ),
    slice(
      "leads",
      "Contact messages",
      () => unwrap(api.admin.api.messages.get(), "GET /admin/api/messages"),
      [],
    ),
    // Public endpoint — no module gate, every role needs the site copy.
    slice<PublicSiteConfig>("sitecontent", "Site content", () => unwrap(api.api["site-config"].get(), "GET /api/site-config"), {
      featuredIds: [],
      homeRowIds: [],
      copy: emptyState().copy,
      contact: emptyState().contact,
      gtm: null,
    }),
  ]);

  const gtmId = typeof config.gtm === "string" ? config.gtm : (config.gtm?.id ?? "");
  const integrations: Integrations = { gtmId, gtmEnabled: Boolean(gtmId) };

  return {
    errors,
    state: {
      roles,
      staff,
      products: products.map(toAdminProduct),
      sections,
      categories,
      featuredIds: config.featuredIds,
      homeRowIds: config.homeRowIds ?? [],
      orders,
      leads,
      industrialLeads,
      customers: customers.map((c) => ({ ...c, joined: shortDate(c.joined) })),
      messages: messages.map((m) => ({ ...m, createdAt: shortDateTime(m.createdAt) })),
      slides,
      copy: config.copy,
      contact: config.contact,
      integrations,
      payments,
      couriers,
      courierProviders,
      sms,
      suppliers,
      purchaseOrders: purchaseOrders.map((po) => ({ ...po, eta: shortDate(po.eta) })),
      movements: movements.map((m) => ({ ...m, date: shortDateTime(m.date) })),
    },
  };
}

/**
 * Re-fetch a subset of collections after mutations that change server state.
 *
 * No permission guard here, unlike loadAdminState: a reloader only ever runs
 * for a collection the user just successfully wrote to, which already proves
 * `manage` on its module.
 */
export const reloaders = {
  products: async () =>
    (await unwrap(api.admin.api.products.get(), "GET /admin/api/products")).map(toAdminProduct),
  sections: () => unwrap(api.admin.api.sections.get(), "GET /admin/api/sections"),
  categories: () => unwrap(api.admin.api.categories.get(), "GET /admin/api/categories"),
  orders: () => unwrap(api.admin.api.orders.get(), "GET /admin/api/orders"),
  leads: () => unwrap(api.admin.api.leads.get(), "GET /admin/api/leads"),
  industrialLeads: () => unwrap(api.admin.api["industrial-leads"].get(), "GET /admin/api/industrial-leads"),
  slides: () => unwrap(api.admin.api.slides.get(), "GET /admin/api/slides"),
  payments: () => unwrap(api.admin.api["payment-methods"].get(), "GET /admin/api/payment-methods"),
  couriers: () => unwrap(api.admin.api.couriers.get(), "GET /admin/api/couriers"),
  suppliers: () => unwrap(api.admin.api.suppliers.get(), "GET /admin/api/suppliers"),
  staff: () => unwrap(api.admin.api.staff.get(), "GET /admin/api/staff"),
  roles: () => unwrap(api.admin.api.roles.get(), "GET /admin/api/roles"),
  purchaseOrders: async () =>
    (await unwrap(api.admin.api["purchase-orders"].get(), "GET /admin/api/purchase-orders")).map(
      (po) => ({ ...po, eta: shortDate(po.eta) }),
    ),
  movements: async () =>
    (await unwrap(api.admin.api.movements.get(), "GET /admin/api/movements")).map((m) => ({
      ...m,
      date: shortDateTime(m.date),
    })),
} satisfies Partial<Record<keyof AdminState, () => Promise<unknown>>>;

/* ===== Mutations ===== */

/** Permanently delete an order. The backend releases any stock it was holding
 *  and cascades to its invoice and warranty records — see the route comment. */
export const deleteOrder = (id: string) =>
  unwrap(api.admin.api.orders({ id }).delete(), "DELETE /admin/api/orders/:id");

export const setOrderStatus = (id: string, status: OrderStatus) =>
  unwrap(api.admin.api.orders({ id }).patch({ status }), "PATCH /admin/api/orders/:id");

/** Assign (or, with null, unassign) the staff member accountable for an order. */
export const setOrderPreparedBy = (id: string, preparedById: string | null) =>
  unwrap(api.admin.api.orders({ id }).patch({ preparedById }), "PATCH /admin/api/orders/:id");

/**
 * Correct the delivery zone of a placed order.
 *
 * The server re-costs delivery and installation from the corrected zone and
 * the product's own fee columns, keeping the unit prices frozen at checkout —
 * no amount is sent from here. Needs `orderadjust: manage`, which is narrower
 * than `orders` on purpose.
 */
export const setOrderZone = (id: string, insideDhaka: boolean) =>
  unwrap(api.admin.api.orders({ id }).patch({ insideDhaka }), "PATCH /admin/api/orders/:id");

/**
 * Override the delivery and/or installation charge by hand.
 *
 * The one place a human-entered amount becomes the charged amount, so the
 * reason is required and the server writes both numbers and the operator into
 * the order's history.
 */
export const adjustOrderCharges = (
  id: string,
  adjust: { deliveryFee?: number; installationFee?: number; reason: string },
) => unwrap(api.admin.api.orders({ id }).patch({ adjust }), "PATCH /admin/api/orders/:id");

/** Lines + audit trail + invoice + warranties, in one call. */
export const getOrderDetail = (id: string) =>
  unwrap(api.admin.api.orders({ id }).get(), "GET /admin/api/orders/:id");

export const setLeadStatus = (id: string, status: LeadStatus) =>
  unwrap(api.admin.api.leads({ id }).patch({ status }), "PATCH /admin/api/leads/:id");

export const setIndustrialLeadStatus = (id: string, status: IndustrialLeadStatus) =>
  unwrap(api.admin.api["industrial-leads"]({ id }).patch({ status }), "PATCH /admin/api/industrial-leads/:id");

export const deleteIndustrialLead = (id: string) =>
  unwrap(api.admin.api["industrial-leads"]({ id }).delete(), "DELETE /admin/api/industrial-leads/:id");

/** Mark a contact message read or unread. The endpoint has existed since the
 *  messages route was written; the admin had simply never called it, so every
 *  message looked identical whether or not someone had dealt with it. */
export const setMessageRead = (id: string, read: boolean) =>
  unwrap(api.admin.api.messages({ id }).patch({ read }), "PATCH /admin/api/messages/:id");

export const setFeatured = (ids: string[]) =>
  unwrap(api.admin.api.products.featured.patch({ ids }), "PATCH /admin/api/products/featured");

export const setHomeRow = (ids: string[]) =>
  unwrap(
    api.admin.api.products["home-row"].patch({ ids }),
    "PATCH /admin/api/products/home-row",
  );

export const putSlides = (slides: HeroSlide[]) =>
  unwrap(
    api.admin.api.slides.put({
      slides: slides.map((s) => ({
        image: s.image,
        mediaType: s.mediaType ?? "image",
        cta: s.cta,
        href: s.href,
        active: s.active,
        fit: s.fit ?? "cover",
        bg: s.bg ?? "",
        // Must be sent. This body is built field by field rather than spread,
        // so a field that isn't listed here is silently dropped — `pages` was,
        // and the route's `?? ["home"]` fallback then reset every slide to the
        // home page on every save. Assigning a banner to Services appeared to
        // work until you pressed Save. Add new slide fields HERE as well as to
        // the type, or they will not persist.
        pages: s.pages ?? ["home"],
      })),
    }),
    "PUT /admin/api/slides",
  );

/*
 * Every upload below hands Eden a plain `{ file }` object — never a FormData.
 * Eden builds the multipart body itself, and it decides to do so by walking the
 * body's own enumerable properties looking for a File (`hasFile`, treaty2). A
 * FormData instance has none, so it takes the JSON branch instead and posts
 * `JSON.stringify(formData)` — the literal string `{}`. The request looks fine
 * from here and comes back 422 `Expected kind 'File' … received: {}`, which
 * reads like a schema bug and is not one.
 */

/** Upload a hero banner image to Cloudinary (server-side) and get its URL back.
 *  The URL is then stored on the slide by the next putSlides() — the upload
 *  itself creates no slide row. */
export const uploadSlideImage = (file: File) =>
  unwrap(api.admin.api.slides.image.post({ file }), "POST /admin/api/slides/image");

/* ===== Catalog taxonomy (Section → Category) ===== */

/** Max SVG markup size the backend accepts — mirrors MAX_SVG_LOGO_BYTES in
 *  ../../backend/src/lib/rules.ts, so the editor can say "too big" before a
 *  round trip. */
export const MAX_SVG_LOGO_BYTES = 32 * 1024;


export const createSection = (body: { name: string; sort: number }) =>
  unwrap(api.admin.api.sections.post(body), "POST /admin/api/sections");

export const patchSection = (id: string, patch: { name?: string; sort?: number }) =>
  unwrap(api.admin.api.sections({ id }).patch(patch), "PATCH /admin/api/sections/:id");

export const deleteSection = (id: string) => unwrap(api.admin.api.sections({ id }).delete(), "DELETE /admin/api/sections/:id");

export const createCategory = (body: { name: string; sectionId: string; sort: number }) =>
  unwrap(api.admin.api.categories.post(body), "POST /admin/api/categories");

export const patchCategory = (
  id: string,
  patch: { name?: string; sectionId?: string; sort?: number },
) => unwrap(api.admin.api.categories({ id }).patch(patch), "PATCH /admin/api/categories/:id");

export const deleteCategory = (id: string) => unwrap(api.admin.api.categories({ id }).delete(), "DELETE /admin/api/categories/:id");

/** Logos are SVG *markup* on the row, not files — the media pipeline
 *  only takes raster formats. `""` clears it. The backend rejects anything
 *  with active content (script, external refs), so a paste from an untrusted
 *  source fails loudly rather than shipping to the storefront. */
export const setCategoryLogo = (id: string, svg: string) =>
  unwrap(api.admin.api.categories({ id }).logo.put({ svg }), "PUT /admin/api/categories/:id/logo");

export const putCopy = (copy: SiteCopy) => unwrap(api.admin.api.copy.put(copy), "PUT /admin/api/copy");
export const putContact = (contact: SiteContact) => unwrap(api.admin.api.contact.put(contact), "PUT /admin/api/contact");
export const putIntegrations = (integrations: Integrations) =>
  unwrap(api.admin.api.integrations.put(integrations), "PUT /admin/api/integrations");

export const putPaymentMethod = (id: string, body: Partial<PaymentMethod>) =>
  unwrap(api.admin.api["payment-methods"]({ id: id }).put(body), "PUT /admin/api/payment-methods/:id");

/* ===== Couriers & shipments ===== */

export const createCourier = (body: Courier) =>
  unwrap(api.admin.api.couriers.post(body), "POST /admin/api/couriers");
/**
 * Ask a courier whether its saved credentials work.
 *
 * Deliberately takes no payload: it tests what the SERVER has, not what is
 * typed in the form. A test of unsaved input confirms the typing and says
 * nothing about what will happen tonight.
 */
export const testCourier = (id: string) =>
  unwrap(api.admin.api.couriers({ id }).test.post(), "POST /admin/api/couriers/:id/test");

export const putSmsSettings = (body: Partial<SmsSettings>) =>
  unwrap(api.admin.api["sms-settings"].put(body), "PUT /admin/api/sms-settings");

export const putCourier = (id: string, body: Partial<Courier>) =>
  unwrap(api.admin.api.couriers({ id }).put(body), "PUT /admin/api/couriers/:id");
export const deleteCourier = (id: string) =>
  unwrap(api.admin.api.couriers({ id }).delete(), "DELETE /admin/api/couriers/:id");

/** Hand an order to a courier. For an API courier this books the parcel. */
export const bookShipment = (
  orderId: string,
  body: {
    courierId: string;
    /** Confirm the order in the same call — see the DTO's note on why it is one act. */
    confirm?: boolean;
    riderId?: string | null;
    consignmentId?: string;
    trackingCode?: string;
    note?: string;
  },
) => unwrap(api.admin.api.orders({ id: orderId }).shipment.post(body), "POST /admin/api/orders/:id/shipment");

export const getShipment = (orderId: string) =>
  unwrap(api.admin.api.orders({ id: orderId }).shipment.get(), "GET /admin/api/orders/:id/shipment");

/** The shipment vocabulary, mirrored from the backend's SHIPMENT_STATUSES. */
export type ShipmentStatus =
  | "Booked"
  | "Picked up"
  | "In transit"
  | "Delivered"
  | "Returned"
  | "Cancelled";

export const patchShipment = (
  id: string,
  body: {
    status?: ShipmentStatus;
    riderId?: string | null;
    consignmentId?: string;
    trackingCode?: string;
    note?: string;
  },
) => unwrap(api.admin.api.shipments({ id }).patch(body), "PATCH /admin/api/shipments/:id");

/** Ask the courier where the parcel is. */
export const syncShipment = (id: string) =>
  unwrap(api.admin.api.shipments({ id }).sync.post(), "POST /admin/api/shipments/:id/sync");

/* ===== Location tree (delivery/installation pricing) ===== */


/**
 * Fields the backend accepts for product create/update (rest is computed).
 *
 * Every amount goes out through `whole()`. The editor lets a fractional value
 * exist in state while it is being typed — it has to, or the input eats the
 * decimal point mid-keystroke — so this is the point where "1250.50" becomes
 * the 1251 that `t.Integer` accepts. Without it the DTO answers 422 with a
 * schema dump and the product cannot be saved at all.
 */
/** 0–100, whole. Both percentage fields are capped server-side, and
 *  `numberInput` deliberately lets you type freely — so without this a pasted
 *  "150" leaves the form and comes back as a 422 with nothing pointing at the
 *  field that caused it. Clamped here, at the one place the payload is built. */
const pct = (n: number) => Math.min(100, Math.max(0, whole(n)));

function productBody(p: AdminProduct) {
  return {
    name: p.name,
    slug: p.slug,
    categoryId: p.categoryId,
    price: whole(p.price),
    minDepositPct: pct(p.minDepositPct),
    recommendedIds: p.recommendedIds,
    onSale: p.onSale,
    // The percentage, not the price: the server derives salePrice from this.
    // Sending both would let the two disagree, which is the failure the
    // percentage design exists to prevent.
    salePct: pct(p.salePct),
    stockTag: p.stockTagOverride,
    deliveryFeeInsideDhaka: whole(p.deliveryFeeInsideDhaka),
    deliveryFeeOutsideDhaka: whole(p.deliveryFeeOutsideDhaka),
    installationFeeInsideDhaka: whole(p.installationFeeInsideDhaka),
    installationFeeOutsideDhaka: whole(p.installationFeeOutsideDhaka),
    // Nested relation writes, not columns — the backend replaces each whole
    // tier list with whatever is sent, so always send the current ones.
    quantityOffers: p.quantityOffers,
    freeDeliveryOffers: p.freeDeliveryOffers,
    warrantyMonths: whole(p.warrantyMonths, { max: 240 }),
    imgHint: p.imgHint,
    specs: p.specs.filter((s) => s.trim() !== ""),
    description: p.description,
    // Always sent. The server used to invent a SKU when this was omitted, so
    // this spread dropped an empty one rather than letting a blank overwrite a
    // generated code. Nothing generates one now — the admin types it, and a
    // blank has to reach the DTO so it comes back as a validation error instead
    // of being quietly discarded on its way out.
    sku: p.sku,
    cost: whole(p.cost),
    reorderAt: whole(p.reorderAt),
    visible: p.visible,
    photos: p.photos.filter((x): x is string => Boolean(x)),
    video: p.video ?? "",
  };
}

/**
 * Create a product.
 *
 * Deliberately does NOT send `id`. It used to send `p.id`, which for a new row
 * was the client-side `tempId("product")` value — and the backend takes a given
 * id as final, so every product added through the admin got a permanent primary
 * key of `product-new-1`. Omitting it lets the server derive one from the slug,
 * the way the seeded catalogue's ids read.
 */
export const createProduct = (p: AdminProduct) =>
  unwrap(api.admin.api.products.post({
    ...productBody(p),
    stock: whole(p.stock),
    reserved: whole(p.reserved),
  }), "POST /admin/api/products").then(toAdminProduct);

export const patchProduct = (p: AdminProduct) =>
  unwrap(api.admin.api.products({ id: p.id }).patch(productBody(p)), "PATCH /admin/api/products/:id");

export const deleteProduct = (id: string) =>
  unwrap(api.admin.api.products({ id: id }).delete(), "DELETE /admin/api/products/:id");


/** Append one photo to a product's gallery (uploaded to Cloudinary by the
 *  service server-side; the API key never reaches the browser). */
export const uploadProductPhoto = (productId: string, file: File) =>
  unwrap(
    api.admin.api.products({ id: productId }).photos.post({ file }),
    "POST /admin/api/products/:id/photos",
  ).then(toAdminProduct);

/** Remove one gallery photo by its position (later photos shift down). */
export const deleteProductPhoto = (productId: string, index: number) =>
  unwrap(
    api.admin.api.products({ id: productId }).photos({ index }).delete(),
    "DELETE /admin/api/products/:id/photos/:index",
  ).then(toAdminProduct);

/** Upload/replace the product's promo video (same storage-service path as photos). */
export const uploadProductVideo = (productId: string, file: File) =>
  unwrap(
    api.admin.api.products({ id: productId }).video.post({ file }),
    "POST /admin/api/products/:id/video",
  ).then(toAdminProduct);

export const deleteProductVideo = (productId: string) =>
  unwrap(
    api.admin.api.products({ id: productId }).video.delete(),
    "DELETE /admin/api/products/:id/video",
  ).then(toAdminProduct);

/* ===== Service catalogues (bookable /services + display-only /industrial) =====
 *
 * Two backend models with an identical shape, so one set of functions covers
 * both — `kind` doubles as the URL segment. Unlike slides/copy these are
 * per-item CRUD (not a whole-document PUT), because each row owns an uploaded
 * image keyed on its server-assigned id.
 */

/** The three card catalogues. All three share one editor and one set of
 *  endpoints — they differ only in which table they write to, and in that only
 *  `services` can have a lead attached. */
export type ServiceKind = "services" | "industrial-services" | "showcase-cards";

export interface AdminService {
  id: string;
  slug: string;
  name: string;
  dsc: string;
  image: string;
  features: string[];
  sort: number;
  /** Which half of the storefront card the photo takes. */
  imageSide: ServiceImageSide;
  /** The marker in front of each feature line. */
  bulletStyle: ServiceBulletStyle;
}

/** Fields the backend accepts on create/update (id and image are server-owned). */
export type ServiceInput = Omit<AdminService, "id" | "image">;

export const getServices = (kind: ServiceKind) => unwrap(api.admin.api[kind].get(), `GET /admin/api/${kind}`);

export const createService = (kind: ServiceKind, body: ServiceInput) =>
  unwrap(api.admin.api[kind].post(body), `POST /admin/api/${kind}`);

export const patchService = (kind: ServiceKind, id: string, patch: Partial<ServiceInput>) =>
  unwrap(api.admin.api[kind]({ id }).patch(patch), `PATCH /admin/api/${kind}/:id`);

/** 409s when a bookable service still has enquiries attached — unwrap() surfaces
 *  the backend's own message, so callers can toast it verbatim. */
export const deleteService = (kind: ServiceKind, id: string) =>
  unwrap(api.admin.api[kind]({ id }).delete(), `DELETE /admin/api/${kind}/:id`);

export const uploadServiceImage = (kind: ServiceKind, id: string, file: File) =>
  unwrap(api.admin.api[kind]({ id }).image.post({ file }), `POST /admin/api/${kind}/:id/image`);

/** Local-state owner for one catalogue, mirroring useLandingPages — services
 *  stay out of AdminState because its whole-object diff-sync has no story for
 *  per-row image uploads or 409 responses. */
export function useServices(kind: ServiceKind) {
  const [list, setList] = useState<AdminService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Same shape as useLandingPages: no synchronous setState in the effect body,
  // only inside .then/.catch, so this is safe to call from the mount effect.
  const fetchList = useCallback(
    (signal?: AbortSignal) =>
      getServices(kind)
        .then((data) => {
          if (signal?.aborted) return;
          setList(data);
          setError(false);
        })
        .catch(() => {
          if (!signal?.aborted) setError(true);
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        }),
    [kind],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchList(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchList]);

  const reload = useCallback(async () => {
    setLoading(true);
    await fetchList();
  }, [fetchList]);

  /** Patch one row in place — avoids a full refetch on every keystroke-save. */
  const replace = useCallback(
    (row: AdminService) => setList((prev) => prev.map((s) => (s.id === row.id ? row : s))),
    [],
  );

  return { list, setList, replace, loading, error, reload };
}

/* ===== Team (the contact page's people) =====
 *
 * Same per-item shape as the card catalogues, and for the same reason: the
 * photo is uploaded against a stable row id, so a member has to exist on the
 * server before their picture can be attached.
 */

export interface AdminTeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo: string;
  sort: number;
}

type TeamInput = Omit<AdminTeamMember, "id" | "photo">;

export const getTeam = () => unwrap(api.admin.api.team.get(), "GET /admin/api/team");

export const createTeamMember = (body: TeamInput) =>
  unwrap(api.admin.api.team.post(body), "POST /admin/api/team");

export const patchTeamMember = (id: string, patch: Partial<TeamInput>) =>
  unwrap(api.admin.api.team({ id }).patch(patch), "PATCH /admin/api/team/:id");

export const deleteTeamMember = (id: string) =>
  unwrap(api.admin.api.team({ id }).delete(), "DELETE /admin/api/team/:id");

export const uploadTeamPhoto = (id: string, file: File) =>
  unwrap(api.admin.api.team({ id }).photo.post({ file }), "POST /admin/api/team/:id/photo");

/** Local-state owner, same shape as useServices. */
export function useTeam() {
  const [list, setList] = useState<AdminTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchList = useCallback(
    (signal?: AbortSignal) =>
      getTeam()
        .then((data) => {
          if (signal?.aborted) return;
          setList(data);
          setError(false);
        })
        .catch(() => {
          if (!signal?.aborted) setError(true);
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        }),
    [],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchList(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchList]);

  const reload = useCallback(async () => {
    setLoading(true);
    await fetchList();
  }, [fetchList]);

  const replace = useCallback(
    (row: AdminTeamMember) => setList((prev) => prev.map((m) => (m.id === row.id ? row : m))),
    [],
  );

  return { list, setList, replace, loading, error, reload };
}

export const adjustStock = (productId: string, onHand: number, reason: string) =>
  unwrap(
    // Whole units, like every other amount this client sends — the count box
    // holds what is being typed, the request holds what the API takes.
    api.admin.api.stock({ productId }).patch({ onHand: whole(onHand), reason }),
    "PATCH /admin/api/stock/:id",
  );

export const createPurchaseOrder = (po: { supplierId: string; productId: string; qty: number }) =>
  unwrap(api.admin.api["purchase-orders"].post({
    ...po,
    eta: new Date(Date.now() + 7 * 86400000).toISOString(),
  }), "POST /admin/api/purchase-orders");

export const receivePurchaseOrder = (id: string) =>
  unwrap(api.admin.api["purchase-orders"]({ id: id }).receive.post(), "POST /admin/api/purchase-orders/:id/receive");

export const cancelPurchaseOrder = (id: string) =>
  unwrap(api.admin.api["purchase-orders"]({ id: id }).cancel.post(), "POST /admin/api/purchase-orders/:id/cancel");

export const createSupplier = (s: Supplier) =>
  unwrap(api.admin.api.suppliers.post({
    name: s.name,
    contact: s.contact,
    phone: s.phone,
    items: s.items,
  }), "POST /admin/api/suppliers");

export const patchSupplier = (s: Supplier) =>
  unwrap(api.admin.api.suppliers({ id: s.id }).patch({
    name: s.name,
    contact: s.contact,
    phone: s.phone,
    items: s.items,
  }), "PATCH /admin/api/suppliers/:id");

export const deleteSupplier = (id: string) =>
  unwrap(api.admin.api.suppliers({ id: id }).delete(), "DELETE /admin/api/suppliers/:id");

export const createStaff = (s: StaffMember) =>
  unwrap(api.admin.api.staff.post({
    name: s.name,
    phone: s.phone,
    email: s.email ?? "",
    username: s.username,
    password: s.password ?? "",
    roleId: s.roleId,
  }), "POST /admin/api/staff");

export const patchStaff = (s: StaffMember) =>
  unwrap(
    api.admin.api.staff({ id: s.id }).patch({
      name: s.name,
      phone: s.phone,
      email: s.email ?? "",
      roleId: s.roleId,
      ...(s.password ? { password: s.password } : {}),
    }),
    "PATCH /admin/api/staff/:id",
  );

export const deleteStaff = (id: string) =>
  unwrap(api.admin.api.staff({ id: id }).delete(), "DELETE /admin/api/staff/:id");

export const createRole = (r: Role) =>
  unwrap(api.admin.api.roles.post({ name: r.name, permissions: r.permissions }), "POST /admin/api/roles");

export const patchRole = (r: Role) =>
  unwrap(api.admin.api.roles({ id: r.id }).patch({
    name: r.name,
    permissions: r.permissions,
  }), "PATCH /admin/api/roles/:id");

export const deleteRole = (id: string) =>
  unwrap(api.admin.api.roles({ id: id }).delete(), "DELETE /admin/api/roles/:id");

/* ===== Metrics (dashboard + analytics) ===== */

export type MetricsPeriod = "week" | "month" | "year";

export interface AdminMetrics {
  kpis: {
    ordersThisWeek: { value: number; pctChange: number };
    revenueThisWeek: { value: number; pctChange: number };
    openLeads: { value: number; newToday: number };
    lowStockCount: number;
    openPoCount: number;
  };
  revenue14d: { date: string; revenue: number }[];
  series: {
    period: MetricsPeriod;
    labels: string[];
    revenue: number[];
    orders: number[];
    newCustomers: number[];
    aov: number[];
  };
  totals: { revenue: number; orders: number; newCustomers: number; aov: number };
  previousTotals: { revenue: number; orders: number; newCustomers: number; aov: number };
  categorySplit: Record<string, number>;
}

export function useAdminMetrics(period: MetricsPeriod) {
  const [result, setResult] = useState<{
    key: MetricsPeriod;
    data: AdminMetrics | null;
    error: boolean;
  } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/admin/api/metrics?period=${period}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((data: AdminMetrics) => setResult({ key: period, data, error: false }))
      .catch(() => {
        if (!ctrl.signal.aborted) setResult({ key: period, data: null, error: true });
      });
    return () => ctrl.abort();
  }, [period]);

  const current = result?.key === period ? result : null;
  return { data: current?.data ?? null, error: current?.error ?? false };
}
