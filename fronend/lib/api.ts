import { products as fallbackCatalog, type Product } from "@/lib/products";
import type { HeroSlide, SiteContact, SiteCopy } from "@/lib/admin";

/*
 * Central client for the ZUP TECH backend (contract: openapi.json /
 * http://localhost:3001/openapi). In the browser we call relative /api paths,
 * which next.config.ts proxies to the backend so the better-auth session
 * cookie stays first-party. On the server (pages, metadata, sitemap) we call
 * the backend directly via BACKEND_URL.
 *
 * No money is ever computed here or anywhere client-side — see cal-bk.md.
 */

function base(): string {
  if (typeof window !== "undefined") return "";
  return process.env.BACKEND_URL ?? "http://localhost:3000";
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base()}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

/** Thrown by postJson on a non-2xx response; carries the HTTP status and,
 *  for Better Auth errors, its stable `code` (e.g. "INVALID_EMAIL_OR_PASSWORD")
 *  so callers can branch without string-matching the message. */
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function sendJson<T>(method: "POST" | "PATCH", path: string, body: unknown): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `${method} ${path} → ${res.status}`;
    let code: string | undefined;
    try {
      // Our own routes send {error}; Better Auth sends {message, code}.
      const data = (await res.json()) as { error?: string; message?: string; code?: string };
      if (data.error) message = data.error;
      else if (data.message) message = data.message;
      code = data.code;
    } catch {
      // non-JSON error body — keep the status message
    }
    throw new ApiError(message, res.status, code);
  }
  return res.json();
}

const postJson = <T>(path: string, body: unknown) => sendJson<T>("POST", path, body);
const patchJson = <T>(path: string, body: unknown) => sendJson<T>("PATCH", path, body);

/* ===== Catalog ===== */

/**
 * Live catalog from the backend. Falls back to the bundled seed catalog if
 * the backend is unreachable, so the site still renders (display only —
 * every charged amount is always computed server-side at quote/order time).
 */
export async function getProducts(): Promise<Product[]> {
  try {
    return await getJson<Product[]>("/api/products");
  } catch (err) {
    console.error("[api] products unavailable, using fallback catalog:", err);
    return fallbackCatalog;
  }
}

/* ===== Service catalogues (admin-managed) ===== */

/** One card from GET /api/services or /api/industrial-services. */
export interface ServiceCard {
  id: string;
  slug: string;
  name: string;
  dsc: string;
  /** media-storage URL, "" when none uploaded. */
  image: string;
  features: string[];
  sort: number;
}

/** Bookable service cards (/services). Falls back to the bundled list. */
export async function getServices(): Promise<ServiceCard[]> {
  try {
    return await getJson<ServiceCard[]>("/api/services");
  } catch (err) {
    console.error("[api] services unavailable, using fallback list:", err);
    return [];
  }
}

/** Display-only infrastructure cards (/industrial). */
export async function getIndustrialServices(): Promise<ServiceCard[]> {
  try {
    return await getJson<ServiceCard[]>("/api/industrial-services");
  } catch (err) {
    console.error("[api] industrial services unavailable, using fallback list:", err);
    return [];
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    const res = await fetch(`${base()}/api/products/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("[api] product unavailable, using fallback catalog:", err);
    return fallbackCatalog.find((p) => p.slug === slug) ?? null;
  }
}

/* ===== Site config (admin-managed, public) ===== */

export interface PaymentOption {
  label: string;
  sub: string;
}

export interface SiteConfig {
  featuredIds: string[];
  slides: HeroSlide[];
  copy: SiteCopy;
  contact: SiteContact;
  gtm: string | { id: string } | null;
  paymentOptions: PaymentOption[];
}

export async function getSiteConfig(): Promise<SiteConfig | null> {
  try {
    return await getJson<SiteConfig>("/api/site-config");
  } catch (err) {
    console.error("[api] site-config unavailable, using defaults:", err);
    return null;
  }
}

/* ===== Customer auth (phone + password, better-auth session cookie) ===== */

export interface Customer {
  id: string;
  name: string;
  /** Login identity — never editable from the profile form. */
  phone: string;
  address: string;
  /** Delivery zone — the backend prices delivery/installation as a two-tier
   *  inside/outside-Dhaka boolean. */
  insideDhaka: boolean;
}

export async function registerCustomer(
  name: string,
  phone: string,
  password: string,
): Promise<void> {
  await postJson("/api/auth/register", { name, phone, password });
}

export async function loginCustomer(phone: string, password: string): Promise<void> {
  await postJson("/api/auth/login", { phone, password });
}

/** Always succeeds (never reveals whether the phone has an account). devToken
 *  is only populated outside production, while no SMS gateway is wired up. */
export async function requestPasswordReset(
  phone: string,
): Promise<{ ok: boolean; devToken?: string }> {
  return postJson("/api/auth/forgot-password", { phone });
}

/** otp is the 6-digit code from requestPasswordReset. */
export async function resetPassword(phone: string, otp: string, password: string): Promise<void> {
  await postJson("/api/auth/reset-password", { phone, otp, password });
}

/** The signed-in customer, or null when there is no session. */
export async function getMe(): Promise<Customer | null> {
  const res = await fetch(`${base()}/api/me`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /api/me → ${res.status}`);
  const data = (await res.json()) as { customer: Customer | null };
  return data.customer;
}

export async function customerLogout(): Promise<void> {
  await fetch(`${base()}/api/auth/logout`, { method: "POST" });
}

/** Edit the signed-in customer's saved name/address/zone — phone stays fixed
 *  since it's the login identity. Every field is optional; send only what
 *  changed. */
export async function updateProfile(
  patch: Partial<Pick<Customer, "name" | "address" | "insideDhaka">>,
): Promise<Customer> {
  const data = await patchJson<{ customer: Customer }>("/api/me", patch);
  return data.customer;
}

/* ===== Orders (session-scoped) ===== */

export type OrderStatus =
  | "Processing"
  | "Confirmed"
  | "On the way"
  | "Delivered"
  | "Cancelled";

export interface MyOrderItem {
  productId: string;
  qty: number;
  unitPrice: number;
}

export interface MyOrder {
  id: string;
  customer: string;
  phone: string;
  address: string;
  items: MyOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  pay: string;
  status: OrderStatus;
  createdAt: string;
}

export async function getMyOrders(): Promise<MyOrder[]> {
  return getJson<MyOrder[]>("/api/my/orders");
}

/* ===== Page heroes (admin-editable hero art) ===== */

export const PAGE_HERO_KEYS = ["home", "shop", "services", "industrial", "contact"] as const;
export type PageHeroKey = (typeof PAGE_HERO_KEYS)[number];

export interface HeroPoster {
  id: string;
  image: string;
  /** "" = decorative; the renderer marks those aria-hidden. */
  alt: string;
  href: string;
  sort: number;
}

export interface PageHero {
  pageKey: string;
  /** "plain" (built-in design) | "image" (one still) | "posters" (rotation). */
  mode: string;
  background: string;
  /** 0–100 dark scrim, so light hero copy stays readable over any art. */
  overlay: number;
  posters: HeroPoster[];
}

/** Every page's hero in one call. Falls back to plain heroes, which render
 *  the frontend's built-in design — so the API being down costs art, not the
 *  page. */
export async function getPageHeroes(): Promise<Record<string, PageHero>> {
  try {
    const list = await getJson<PageHero[]>("/api/page-heroes");
    return Object.fromEntries(list.map((h) => [h.pageKey, h]));
  } catch (err) {
    console.error("[api] page heroes unavailable, using built-in designs:", err);
    return {};
  }
}

/* ===== Landing pages (unlisted ad campaign pages) ===== */

/** GET /api/landing-pages/:slug. The product is embedded rather than fetched
 *  separately — a campaign may sell a product that is off the storefront, and
 *  GET /api/products/:slug 404s on those. */
export interface PublicLandingPage {
  /** Already resolved server-side — falls back to the product name. */
  headline: string;
  slug: string;
  offerPrice: number;
  compareAtPrice: number;
  /** Derived server-side so the page and the ad creative can't disagree. */
  discountPercentage: number;
  ribbonText: string;
  buttonLabel: string;
  footerNote: string;
  benefitBullets: string[];
  imageHint: string;
  gtmId: string;
  product: Product;
}

/** null for unknown AND unpublished slugs — the route can't tell them apart,
 *  which is what keeps an unpublished campaign genuinely unlisted. */
export async function getLandingPage(slug: string): Promise<PublicLandingPage | null> {
  try {
    const res = await fetch(`${base()}/api/landing-pages/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicLandingPage;
  } catch (err) {
    console.error("[api] landing page unavailable:", err);
    return null;
  }
}

/* ===== Leads & contact messages ===== */

/** Home-service booking (/services). `serviceId` must be a real Service.id —
 *  the backend 404s otherwise so leads stay groupable by service in reporting. */
export interface LeadInput {
  serviceId: string;
  customer: string;
  city: string;
  phone?: string;
  notes?: string;
}

export async function submitLead(lead: LeadInput): Promise<void> {
  await postJson("/api/leads", lead);
}

/* ===== Industrial enquiries ===== */

export const INDUSTRIAL_SECTORS = [
  "Manufacturing",
  "Textile & RMG",
  "Pharmaceutical",
  "Food & Beverage",
  "Data centre",
  "Hospital & healthcare",
  "Commercial building",
  "Power & utility",
  "Other",
] as const;
export type IndustrialSector = (typeof INDUSTRIAL_SECTORS)[number];

export const INDUSTRIAL_SCOPES = [
  "New installation",
  "Upgrade / retrofit",
  "Maintenance contract",
  "Consultancy only",
] as const;
export type IndustrialScope = (typeof INDUSTRIAL_SCOPES)[number];

export const INDUSTRIAL_TIMELINES = [
  "Immediate",
  "1-3 months",
  "3-6 months",
  "6+ months",
  "Planning / budgeting",
] as const;
export type IndustrialTimeline = (typeof INDUSTRIAL_TIMELINES)[number];

/**
 * B2B enquiry from /industrial — a different fact set from LeadInput because
 * an industrial deal is qualified on company, sector, connected load and
 * timeline rather than on a person and a city.
 *
 * `industrialServiceId` is optional and best-effort: the page falls back to
 * the static list in lib/industrial.ts when the API is down, and those ids
 * have no row behind them. The backend links it only when it resolves and
 * always stores `serviceName`, so a stale id costs the link, not the lead.
 */
export interface IndustrialLeadInput {
  industrialServiceId?: string;
  serviceName: string;
  company: string;
  contactName: string;
  designation?: string;
  phone: string;
  email?: string;
  sector: IndustrialSector;
  scope: IndustrialScope;
  timeline: IndustrialTimeline;
  siteLocation?: string;
  load?: string;
  budget?: string;
  notes?: string;
}

export async function submitIndustrialLead(lead: IndustrialLeadInput): Promise<void> {
  await postJson("/api/industrial-leads", lead);
}

export interface ContactInput {
  name: string;
  message: string;
  phone?: string;
  email?: string;
}

export async function submitContactMessage(input: ContactInput): Promise<void> {
  await postJson("/api/contact", input);
}
