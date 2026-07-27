"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AdminCustomer,
  AdminModule,
  AdminOrder,
  AdminProduct,
  AdminState,
  ContactMessage,
  HeroSlide,
  Integrations,
  AdminCategory,
  AdminSection,
  IndustrialLead,
  IndustrialLeadStatus,
  LeadStatus,
  OrderDetail,
  OrderStatus,
  PaymentMethod,
  Permission,
  PurchaseOrder,
  Role,
  ServiceLead,
  SiteContact,
  SiteCopy,
  StaffMember,
  StockMovement,
  Supplier,
} from "@/lib/admin";

/*
 * Typed client for the backend's /admin/api endpoints (contract:
 * openapi.json). All calls are same-origin — next.config.ts proxies them to
 * the backend, so the better-auth staff session cookie applies.
 */

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `${method} ${path} → ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // keep status message
    }
    throw new Error(message);
  }
  return res.json();
}

const get = <T,>(path: string) => req<T>("GET", path);

/* ===== Auth / session ===== */

export interface AdminMe {
  staff: { id: string; name: string; username: string; phone: string };
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
    categoryId: p.categoryId ?? "",
    category: p.category ?? "",
    section: p.section ?? "",
    freeDeliveryMinQty: p.freeDeliveryMinQty ?? 0,
  };
}

interface PublicSiteConfig {
  featuredIds: string[];
  copy: SiteCopy;
  contact: SiteContact;
  gtm: string | { id: string } | null;
}

/** Assemble the whole admin state from the backend's granular endpoints. */
export async function loadAdminState(): Promise<AdminState> {
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
    get<Role[]>("/admin/api/roles"),
    get<StaffMember[]>("/admin/api/staff"),
    get<AdminProduct[]>("/admin/api/products"),
    get<AdminSection[]>("/admin/api/sections"),
    get<AdminCategory[]>("/admin/api/categories"),
    get<AdminOrder[]>("/admin/api/orders"),
    get<ServiceLead[]>("/admin/api/leads"),
    get<IndustrialLead[]>("/admin/api/industrial-leads"),
    get<(AdminCustomer & { joined: string })[]>("/admin/api/customers"),
    get<HeroSlide[]>("/admin/api/slides"),
    get<PaymentMethod[]>("/admin/api/payment-methods"),
    get<Supplier[]>("/admin/api/suppliers"),
    get<(PurchaseOrder & { eta: string })[]>("/admin/api/purchase-orders"),
    get<(StockMovement & { date: string })[]>("/admin/api/movements"),
    get<(ContactMessage & { createdAt: string })[]>("/admin/api/messages"),
    get<PublicSiteConfig>("/api/site-config"),
  ]);

  const gtmId = typeof config.gtm === "string" ? config.gtm : (config.gtm?.id ?? "");
  const integrations: Integrations = { gtmId, gtmEnabled: Boolean(gtmId) };

  return {
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
  };
}

/** Re-fetch a subset of collections after mutations that change server state. */
export const reloaders = {
  products: async () =>
    (await get<AdminProduct[]>("/admin/api/products")).map(toAdminProduct),
  sections: () => get<AdminSection[]>("/admin/api/sections"),
  categories: () => get<AdminCategory[]>("/admin/api/categories"),
  orders: () => get<AdminOrder[]>("/admin/api/orders"),
  leads: () => get<ServiceLead[]>("/admin/api/leads"),
  industrialLeads: () => get<IndustrialLead[]>("/admin/api/industrial-leads"),
  slides: () => get<HeroSlide[]>("/admin/api/slides"),
  payments: () => get<PaymentMethod[]>("/admin/api/payment-methods"),
  suppliers: () => get<Supplier[]>("/admin/api/suppliers"),
  staff: () => get<StaffMember[]>("/admin/api/staff"),
  roles: () => get<Role[]>("/admin/api/roles"),
  purchaseOrders: async () =>
    (await get<(PurchaseOrder & { eta: string })[]>("/admin/api/purchase-orders")).map(
      (po) => ({ ...po, eta: shortDate(po.eta) }),
    ),
  movements: async () =>
    (await get<(StockMovement & { date: string })[]>("/admin/api/movements")).map((m) => ({
      ...m,
      date: shortDateTime(m.date),
    })),
} satisfies Partial<Record<keyof AdminState, () => Promise<unknown>>>;

/* ===== Mutations ===== */

export const setOrderStatus = (id: string, status: OrderStatus) =>
  req("PATCH", `/admin/api/orders/${encodeURIComponent(id)}`, { status });

/** Assign (or, with null, unassign) the staff member accountable for an order. */
export const setOrderPreparedBy = (id: string, preparedById: string | null) =>
  req<OrderDetail>("PATCH", `/admin/api/orders/${encodeURIComponent(id)}`, { preparedById });

/** Lines + audit trail + invoice + warranties, in one call. */
export const getOrderDetail = (id: string) =>
  get<OrderDetail>(`/admin/api/orders/${encodeURIComponent(id)}`);

export const setLeadStatus = (id: string, status: LeadStatus) =>
  req("PATCH", `/admin/api/leads/${encodeURIComponent(id)}`, { status });

export const setIndustrialLeadStatus = (id: string, status: IndustrialLeadStatus) =>
  req("PATCH", `/admin/api/industrial-leads/${encodeURIComponent(id)}`, { status });

export const deleteIndustrialLead = (id: string) =>
  req("DELETE", `/admin/api/industrial-leads/${encodeURIComponent(id)}`);

export const setFeatured = (ids: string[]) =>
  req("PATCH", "/admin/api/products/featured", { ids });

export const putSlides = (slides: HeroSlide[]) =>
  req("PUT", "/admin/api/slides", {
    slides: slides.map((s) => ({
      image: s.image,
      cta: s.cta,
      href: s.href,
      active: s.active,
      fit: s.fit ?? "cover",
      bg: s.bg ?? "",
    })),
  });

/** Upload a hero banner image to the media-storage service and get its URL back.
 *  The URL is then stored on the slide by the next putSlides() — the upload
 *  itself creates no slide row. */
export const uploadSlideImage = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return postForm<{ url: string }>("/admin/api/slides/image", form);
};

/* ===== Catalog taxonomy (Section → Category) ===== */

/** Max SVG markup size the backend accepts — mirrors MAX_SVG_LOGO_BYTES in
 *  ../../backend/src/lib/rules.ts, so the editor can say "too big" before a
 *  round trip. */
export const MAX_SVG_LOGO_BYTES = 32 * 1024;

const sectionAt = (id: string) => `/admin/api/sections/${encodeURIComponent(id)}`;
const categoryAt = (id: string) => `/admin/api/categories/${encodeURIComponent(id)}`;

export const createSection = (body: { name: string; sort: number }) =>
  req<AdminSection>("POST", "/admin/api/sections", body);

export const patchSection = (id: string, patch: { name?: string; sort?: number }) =>
  req<AdminSection>("PATCH", sectionAt(id), patch);

export const deleteSection = (id: string) => req<{ ok: true }>("DELETE", sectionAt(id));

export const createCategory = (body: { name: string; sectionId: string; sort: number }) =>
  req<AdminCategory>("POST", "/admin/api/categories", body);

export const patchCategory = (
  id: string,
  patch: { name?: string; sectionId?: string; sort?: number },
) => req<AdminCategory>("PATCH", categoryAt(id), patch);

export const deleteCategory = (id: string) => req<{ ok: true }>("DELETE", categoryAt(id));

/** Logos are SVG *markup* on the row, not files — the media-storage service
 *  only takes raster formats. `""` clears it. The backend rejects anything
 *  with active content (script, external refs), so a paste from an untrusted
 *  source fails loudly rather than shipping to the storefront. */
export const setCategoryLogo = (id: string, svg: string) =>
  req<AdminCategory>("PUT", `${categoryAt(id)}/logo`, { svg });

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
export const getPageHeroes = () => get<PageHero[]>("/admin/api/page-heroes");

const heroAt = (k: string) => `/admin/api/page-heroes/${encodeURIComponent(k)}`;

export const putPageHero = (
  pageKey: string,
  body: { mode: PageHeroMode; overlay: number; background?: string },
) => req<PageHero>("PUT", heroAt(pageKey), body);

/** Uploading also switches the hero into the matching mode server-side, so
 *  the admin sees the art immediately instead of an invisible upload. */
export const uploadHeroBackground = (pageKey: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return postForm<PageHero>(`${heroAt(pageKey)}/background`, form);
};

export const uploadHeroPoster = (pageKey: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return postForm<PageHero>(`${heroAt(pageKey)}/posters`, form);
};

export const patchHeroPoster = (id: string, patch: { alt?: string; href?: string }) =>
  req<PageHero>("PATCH", `/admin/api/hero-posters/${encodeURIComponent(id)}`, patch);

export const deleteHeroPoster = (id: string) =>
  req<PageHero>("DELETE", `/admin/api/hero-posters/${encodeURIComponent(id)}`);

export const reorderHeroPosters = (pageKey: string, ids: string[]) =>
  req<PageHero>("PUT", `${heroAt(pageKey)}/posters/order`, { ids });

export const putCopy = (copy: SiteCopy) => req("PUT", "/admin/api/copy", copy);
export const putContact = (contact: SiteContact) => req("PUT", "/admin/api/contact", contact);
export const putIntegrations = (integrations: Integrations) =>
  req("PUT", "/admin/api/integrations", integrations);

export const putPaymentMethod = (id: string, body: Partial<PaymentMethod>) =>
  req("PUT", `/admin/api/payment-methods/${encodeURIComponent(id)}`, body);

/* ===== Location tree (delivery/installation pricing) ===== */

export interface AdminLocationNode {
  id: string;
  type: "DIVISION" | "DISTRICT" | "CITY_CORPORATION" | "UPAZILA" | "THANA" | "CITY_CORP_AREA" | "UNION" | "WARD";
  name: string;
  parentId: string | null;
  deliveryCost: number;
  installationCost: number;
  sort: number;
  isLeaf: boolean;
  hasChildren: boolean;
}

export const getLocationChildren = (parentId: string | null) =>
  get<AdminLocationNode[]>(
    `/admin/api/locations${parentId ? `?parentId=${encodeURIComponent(parentId)}` : ""}`,
  );

export const patchLocationNode = (
  id: string,
  body: Partial<{ name: string; deliveryCost: number; installationCost: number; sort: number }>,
) => req<AdminLocationNode>("PATCH", `/admin/api/locations/${encodeURIComponent(id)}`, body);

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
    freeDeliveryMinQty: p.freeDeliveryMinQty,
    // A nested relation write, not a column — the backend replaces the whole
    // tier list with whatever is sent, so always send the current one.
    quantityOffers: p.quantityOffers,
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
  req("POST", "/admin/api/products", {
    id: p.id,
    ...productBody(p),
    stock: p.stock,
    reserved: p.reserved,
  });

export const patchProduct = (p: AdminProduct) =>
  req("PATCH", `/admin/api/products/${encodeURIComponent(p.id)}`, productBody(p));

export const deleteProduct = (id: string) =>
  req("DELETE", `/admin/api/products/${encodeURIComponent(id)}`);

async function postForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(path, { method: "POST", body: form });
  if (!res.ok) {
    let message = `POST ${path} → ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // keep status message
    }
    throw new Error(message);
  }
  return res.json();
}

/** Append one photo to a product's gallery (goes to the media-storage
 *  service server-side; the API key never reaches the browser). */
export const uploadProductPhoto = (productId: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return postForm<AdminProduct>(
    `/admin/api/products/${encodeURIComponent(productId)}/photos`,
    form,
  ).then(toAdminProduct);
};

/** Remove one gallery photo by its position (later photos shift down). */
export const deleteProductPhoto = (productId: string, index: number) =>
  req<AdminProduct>(
    "DELETE",
    `/admin/api/products/${encodeURIComponent(productId)}/photos/${index}`,
  ).then(toAdminProduct);

/** Upload/replace the product's promo video (same storage-service path as photos). */
export const uploadProductVideo = (productId: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return postForm<AdminProduct>(
    `/admin/api/products/${encodeURIComponent(productId)}/video`,
    form,
  ).then(toAdminProduct);
};

export const deleteProductVideo = (productId: string) =>
  req<AdminProduct>(
    "DELETE",
    `/admin/api/products/${encodeURIComponent(productId)}/video`,
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

export const getServices = (kind: ServiceKind) => get<AdminService[]>(`/admin/api/${kind}`);

export const createService = (kind: ServiceKind, body: ServiceInput) =>
  req<AdminService>("POST", `/admin/api/${kind}`, body);

export const patchService = (kind: ServiceKind, id: string, patch: Partial<ServiceInput>) =>
  req<AdminService>("PATCH", `/admin/api/${kind}/${encodeURIComponent(id)}`, patch);

/** 409s when a bookable service still has enquiries attached — req() surfaces
 *  the backend's own message, so callers can toast it verbatim. */
export const deleteService = (kind: ServiceKind, id: string) =>
  req<void>("DELETE", `/admin/api/${kind}/${encodeURIComponent(id)}`);

export const uploadServiceImage = (kind: ServiceKind, id: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return postForm<AdminService>(`/admin/api/${kind}/${encodeURIComponent(id)}/image`, form);
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
  req("PATCH", `/admin/api/stock/${encodeURIComponent(productId)}`, { onHand, reason });

export const createPurchaseOrder = (po: { supplierId: string; productId: string; qty: number }) =>
  req("POST", "/admin/api/purchase-orders", {
    ...po,
    eta: new Date(Date.now() + 7 * 86400000).toISOString(),
  });

export const receivePurchaseOrder = (id: string) =>
  req("POST", `/admin/api/purchase-orders/${encodeURIComponent(id)}/receive`);

export const cancelPurchaseOrder = (id: string) =>
  req("POST", `/admin/api/purchase-orders/${encodeURIComponent(id)}/cancel`);

export const createSupplier = (s: Supplier) =>
  req("POST", "/admin/api/suppliers", {
    name: s.name,
    contact: s.contact,
    phone: s.phone,
    items: s.items,
  });

export const patchSupplier = (s: Supplier) =>
  req("PATCH", `/admin/api/suppliers/${encodeURIComponent(s.id)}`, {
    name: s.name,
    contact: s.contact,
    phone: s.phone,
    items: s.items,
  });

export const deleteSupplier = (id: string) =>
  req("DELETE", `/admin/api/suppliers/${encodeURIComponent(id)}`);

export const createStaff = (s: StaffMember) =>
  req("POST", "/admin/api/staff", {
    name: s.name,
    phone: s.phone,
    username: s.username,
    password: s.password ?? "",
    roleId: s.roleId,
  });

export const patchStaff = (s: StaffMember) =>
  req("PATCH", `/admin/api/staff/${encodeURIComponent(s.id)}`, {
    name: s.name,
    phone: s.phone,
    roleId: s.roleId,
    ...(s.password ? { password: s.password } : {}),
  });

export const deleteStaff = (id: string) =>
  req("DELETE", `/admin/api/staff/${encodeURIComponent(id)}`);

export const createRole = (r: Role) =>
  req("POST", "/admin/api/roles", { name: r.name, permissions: r.permissions });

export const patchRole = (r: Role) =>
  req("PATCH", `/admin/api/roles/${encodeURIComponent(r.id)}`, {
    name: r.name,
    permissions: r.permissions,
  });

export const deleteRole = (id: string) =>
  req("DELETE", `/admin/api/roles/${encodeURIComponent(id)}`);

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
