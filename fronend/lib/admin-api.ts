"use client";

import { useCallback, useEffect, useState } from "react";
import { unwrap } from "@/lib/admin-http";
import { api } from "@/lib/eden";
import { emptyState } from "@/lib/admin";
import type {
  AdminModule,
  AdminProduct,
  AdminState,
  HeroSlide,
  Integrations,
  IndustrialLeadStatus,
  LeadStatus,
  OrderStatus,
  PaymentMethod,
  Permission,
  Role,
  SiteContact,
  SiteCopy,
  StaffMember,
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

/** Mails a 6-digit reset code. Always resolves, whether or not the address
 *  belongs to a staff account — the server won't say, and neither do we. */
export const adminForgotPassword = (email: string) =>
  unwrap(api.admin.api["forgot-password"].post({ email }), "POST /admin/api/forgot-password");

/** Consumes the code from adminForgotPassword and sets the new password. */
export const adminResetPassword = (email: string, otp: string, password: string) =>
  unwrap(api.admin.api["reset-password"].post({ email, otp, password }), "POST /admin/api/reset-password");

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
export function toAdminProduct(p: AdminProduct & { photos?: (string | null)[] }): AdminProduct {
  return {
    ...p,
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
      })),
    }),
    "PUT /admin/api/slides",
  );

/** Upload a hero banner image to the media-storage service and get its URL back.
 *  The URL is then stored on the slide by the next putSlides() — the upload
 *  itself creates no slide row. */
export const uploadSlideImage = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return unwrap(api.admin.api.slides.image.post(form as never), "POST /admin/api/slides/image");
};

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

/** Logos are SVG *markup* on the row, not files — the media-storage service
 *  only takes raster formats. `""` clears it. The backend rejects anything
 *  with active content (script, external refs), so a paste from an untrusted
 *  source fails loudly rather than shipping to the storefront. */
export const setCategoryLogo = (id: string, svg: string) =>
  unwrap(api.admin.api.categories({ id }).logo.put({ svg }), "PUT /admin/api/categories/:id/logo");

/* ===== Page heroes ===== */

export const PAGE_HERO_KEYS = ["home", "shop", "services", "industrial", "contact"] as const;
export type PageHeroKey = (typeof PAGE_HERO_KEYS)[number];
export type PageHeroMode = "plain" | "image" | "posters";

export interface HeroPoster {
  id: string;
  image: string;
  alt: string;
  href: string;
  sort: number;
}

export interface PageHero {
  pageKey: string;
  mode: PageHeroMode;
  background: string;
  overlay: number;
  posters: HeroPoster[];
}

/** Always returns one entry per key — pages never edited come back as
 *  `mode: "plain"`, so the admin renders an editor without a create step. */
export const getPageHeroes = () => unwrap(api.admin.api["page-heroes"].get(), "GET /admin/api/page-heroes");


export const putPageHero = (
  pageKey: string,
  body: { mode: PageHeroMode; overlay: number; background?: string },
) => unwrap(api.admin.api["page-heroes"]({ pageKey }).put(body), "PUT /admin/api/page-heroes/:pageKey");

/** Uploading also switches the hero into the matching mode server-side, so
 *  the admin sees the art immediately instead of an invisible upload. */
export const uploadHeroBackground = (pageKey: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return unwrap(api.admin.api["page-heroes"]({ pageKey }).background.post(form as never), "POST /admin/api/page-heroes/:pageKey/background");
};

export const uploadHeroPoster = (pageKey: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return unwrap(api.admin.api["page-heroes"]({ pageKey }).posters.post(form as never), "POST /admin/api/page-heroes/:pageKey/posters");
};

export const patchHeroPoster = (id: string, patch: { alt?: string; href?: string }) =>
  unwrap(api.admin.api["hero-posters"]({ id }).patch(patch), "PATCH /admin/api/hero-posters/:id");

export const deleteHeroPoster = (id: string) =>
  unwrap(api.admin.api["hero-posters"]({ id }).delete(), "DELETE /admin/api/hero-posters/:id");

export const reorderHeroPosters = (pageKey: string, ids: string[]) =>
  unwrap(api.admin.api["page-heroes"]({ pageKey }).posters.order.put({ ids }), "PUT /admin/api/page-heroes/:pageKey/posters/order");

export const putCopy = (copy: SiteCopy) => unwrap(api.admin.api.copy.put(copy), "PUT /admin/api/copy");
export const putContact = (contact: SiteContact) => unwrap(api.admin.api.contact.put(contact), "PUT /admin/api/contact");
export const putIntegrations = (integrations: Integrations) =>
  unwrap(api.admin.api.integrations.put(integrations), "PUT /admin/api/integrations");

export const putPaymentMethod = (id: string, body: Partial<PaymentMethod>) =>
  unwrap(api.admin.api["payment-methods"]({ id: id }).put(body), "PUT /admin/api/payment-methods/:id");

/* ===== Location tree (delivery/installation pricing) ===== */


/** Fields the backend accepts for product create/update (rest is computed). */
function productBody(p: AdminProduct) {
  return {
    name: p.name,
    slug: p.slug,
    categoryId: p.categoryId,
    price: p.price,
    minDp: p.minDp,
    onSale: p.onSale,
    salePercentage: p.salePercentage,
    deliveryFeeInsideDhaka: p.deliveryFeeInsideDhaka,
    deliveryFeeOutsideDhaka: p.deliveryFeeOutsideDhaka,
    installationFeeInsideDhaka: p.installationFeeInsideDhaka,
    installationFeeOutsideDhaka: p.installationFeeOutsideDhaka,
    // Nested relation writes, not columns — the backend replaces each whole
    // tier list with whatever is sent, so always send the current ones.
    quantityOffers: p.quantityOffers,
    freeDeliveryOffers: p.freeDeliveryOffers,
    warrantyMonths: p.warrantyMonths,
    imgHint: p.imgHint,
    specs: p.specs.filter((s) => s.trim() !== ""),
    description: p.description,
    // SKU is server-generated on create; never send an empty one back.
    ...(p.sku ? { sku: p.sku } : {}),
    cost: p.cost,
    reorderAt: p.reorderAt,
    visible: p.visible,
    photos: p.photos.filter((x): x is string => Boolean(x)),
    video: p.video ?? "",
  };
}

export const createProduct = (p: AdminProduct) =>
  unwrap(api.admin.api.products.post({
    id: p.id,
    ...productBody(p),
    stock: p.stock,
    reserved: p.reserved,
  }), "POST /admin/api/products");

export const patchProduct = (p: AdminProduct) =>
  unwrap(api.admin.api.products({ id: p.id }).patch(productBody(p)), "PATCH /admin/api/products/:id");

export const deleteProduct = (id: string) =>
  unwrap(api.admin.api.products({ id: id }).delete(), "DELETE /admin/api/products/:id");


/** Append one photo to a product's gallery (goes to the media-storage
 *  service server-side; the API key never reaches the browser). */
export const uploadProductPhoto = (productId: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return unwrap(
    api.admin.api.products({ id: productId }).photos.post(form as never),
    "POST /admin/api/products/:id/photos",
  ).then(toAdminProduct);
};

/** Remove one gallery photo by its position (later photos shift down). */
export const deleteProductPhoto = (productId: string, index: number) =>
  unwrap(
    api.admin.api.products({ id: productId }).photos({ index }).delete(),
    "DELETE /admin/api/products/:id/photos/:index",
  ).then(toAdminProduct);

/** Upload/replace the product's promo video (same storage-service path as photos). */
export const uploadProductVideo = (productId: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return unwrap(
    api.admin.api.products({ id: productId }).video.post(form as never),
    "POST /admin/api/products/:id/video",
  ).then(toAdminProduct);
};

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

export type ServiceKind = "services" | "industrial-services";

export interface AdminService {
  id: string;
  slug: string;
  name: string;
  dsc: string;
  image: string;
  features: string[];
  sort: number;
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

export const uploadServiceImage = (kind: ServiceKind, id: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return unwrap(api.admin.api[kind]({ id }).image.post(form as never), `POST /admin/api/${kind}/:id/image`);
};

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

export const adjustStock = (productId: string, onHand: number, reason: string) =>
  unwrap(api.admin.api.stock({ productId }).patch({ onHand, reason }), "PATCH /admin/api/stock/:id");

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
