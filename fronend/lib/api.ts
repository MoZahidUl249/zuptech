import { products as fallbackCatalog, type Product } from "@/lib/products";
import type { HeroSlide, SiteContact, SiteCopy } from "@/lib/admin";
import { api, failureStatus, type EdenFailure } from "@/lib/eden";
import { ApiRequestError, logApiFailure } from "@/lib/api-error";

/*
 * Central client for the ZUP TECH backend (contract: openapi.json /
 * http://localhost:3001/openapi). In the browser we call relative /api paths,
 * which next.config.ts proxies to the backend so the better-auth session
 * cookie stays first-party. On the server (pages, metadata, sitemap) we call
 * the backend directly via BACKEND_URL.
 *
 * No money is ever computed here or anywhere client-side — see cal-bk.md.
 */

/** Thrown on a non-2xx response; carries the HTTP status and, for Better Auth
 *  errors, its stable `code` (e.g. "INVALID_EMAIL_OR_PASSWORD") so callers can
 *  branch without string-matching the message. Also carries the method, path
 *  and the server's validation detail — see lib/api-error.ts. */
export class ApiError extends ApiRequestError {
  constructor(init: { status: number; method: string; path: string; body: unknown }) {
    super(init);
    this.name = "ApiError";
  }
}

/**
 * Turns an Eden `{data, error}` result back into the throw-on-failure contract
 * every caller in this file (and the components above it) already expects.
 * Eden gives us the typed request and response; this keeps the error handling
 * unchanged so nothing downstream had to be rewritten.
 */
async function unwrap<T>(
  call: Promise<{ data: T | null; error: EdenFailure | null }>,
  what: string,
): Promise<T> {
  const { data, error } = await call;
  if (error) {
    const [method = "GET", ...rest] = what.split(" ");
    const failure = new ApiError({
      status: failureStatus(error),
      method,
      path: rest.join(" "),
      body: error.value,
    });
    logApiFailure(failure);
    throw failure;
  }
  return data as T;
}

/* ===== Catalog ===== */

/**
 * Live catalog from the backend. Falls back to the bundled seed catalog if
 * the backend is unreachable, so the site still renders (display only —
 * every charged amount is always computed server-side at quote/order time).
 */
export async function getProducts(): Promise<Product[]> {
  try {
    return await unwrap(api.api.products.get(), "GET /api/products");
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
    return await unwrap(api.api.services.get(), "GET /api/services");
  } catch (err) {
    console.error("[api] services unavailable, using fallback list:", err);
    return [];
  }
}

/** Display-only infrastructure cards (/industrial). */
export async function getIndustrialServices(): Promise<ServiceCard[]> {
  try {
    return await unwrap(api.api["industrial-services"].get(), "GET /api/industrial-services");
  } catch (err) {
    console.error("[api] industrial services unavailable, using fallback list:", err);
    return [];
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    // 404 is "no such product", not a failure — distinguish it from the
    // backend being unreachable, which falls through to the seed catalog.
    const { data, error } = await api.api.products({ slug }).get();
    if (error) {
      const status = failureStatus(error);
      if (status === 404) return null;
      throw new ApiError({ status, method: "GET", path: `/api/products/${slug}`, body: error.value });
    }
    return data as Product;
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
    return await unwrap(api.api["site-config"].get(), "GET /api/site-config");
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
  /** Where password-reset codes are delivered. "" on accounts created before
   *  it was collected, and on guest-checkout rows — those can't self-reset. */
  email: string;
  address: string;
  /** Delivery zone — the backend prices delivery/installation as a two-tier
   *  inside/outside-Dhaka boolean. */
  insideDhaka: boolean;
}

export async function registerCustomer(
  name: string,
  phone: string,
  email: string,
  password: string,
): Promise<void> {
  await unwrap(
    api.api.auth.register.post({ name, phone, email, password }),
    "POST /api/auth/register",
  );
}

export async function loginCustomer(phone: string, password: string): Promise<void> {
  await unwrap(api.api.auth.login.post({ phone, password }), "POST /api/auth/login");
}

/**
 * Set a password on the number a guest just ordered with, offered on the
 * order success screen. Only works for a phone that has ordered but has no
 * account yet — the backend answers the same way for every other case, so
 * don't try to distinguish them here.
 */
export async function claimAccount(
  phone: string,
  password: string,
  email?: string,
): Promise<void> {
  await unwrap(
    api.api.auth.claim.post({ phone, password, ...(email ? { email } : {}) }),
    "POST /api/auth/claim",
  );
}

/** Mails a 6-digit code. Always succeeds — the response never reveals whether
 *  the address belongs to an account, and the code only travels by email. */
export async function requestPasswordReset(email: string): Promise<{ ok: boolean }> {
  return unwrap(
    api.api.auth["forgot-password"].post({ email }),
    "POST /api/auth/forgot-password",
  );
}

/** otp is the 6-digit code from requestPasswordReset. */
export async function resetPassword(email: string, otp: string, password: string): Promise<void> {
  await unwrap(
    api.api.auth["reset-password"].post({ email, otp, password }),
    "POST /api/auth/reset-password",
  );
}

/** The signed-in customer, or null when there is no session. */
export async function getMe(): Promise<Customer | null> {
  const { customer } = await unwrap(api.api.me.get(), "GET /api/me");
  return customer;
}

export async function customerLogout(): Promise<void> {
  await api.api.auth.logout.post();
}

/** Edit the signed-in customer's saved name/address/zone — phone stays fixed
 *  since it's the login identity. Every field is optional; send only what
 *  changed. */
export async function updateProfile(
  patch: Partial<Pick<Customer, "name" | "address" | "insideDhaka">>,
): Promise<Customer> {
  const { customer } = await unwrap(api.api.me.patch(patch), "PATCH /api/me");
  return customer;
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
  return unwrap(api.api.my.orders.get(), "GET /api/my/orders");
}

/**
 * Checkout payload. No amounts — the server reprices the whole cart from the
 * catalog and returns the authoritative order (see cal-bk.md).
 *
 * `name`/`phone`/`address` are omitted entirely by a signed-in customer
 * ordering to their saved address: the backend takes identity from the session
 * cookie, so sending them would be at best redundant and at worst a way to
 * post against someone else's account. `saveAddress` asks the backend to make
 * this the account's new default — it is ignored for guests, who have no
 * account to save to.
 */
export interface PlaceOrderInput {
  name?: string;
  phone?: string;
  address?: string;
  insideDhaka: boolean;
  pay: string;
  items: { productId: string; qty: number }[];
  saveAddress?: boolean;
}

export interface PlacedOrder {
  orderId: string;
  total: number;
  status: OrderStatus;
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlacedOrder> {
  return unwrap(api.api.orders.post(input), "POST /api/orders");
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
    const list = await unwrap(api.api["page-heroes"].get(), "GET /api/page-heroes");
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
  /** compareAtPrice − offerPrice. Rendered, never recomputed here. */
  youSave: number;
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
    const { data, error } = await api.api["landing-pages"]({ slug }).get();
    if (error) return null;
    return data as PublicLandingPage;
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
  await unwrap(api.api.leads.post(lead), "POST /api/leads");
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
  await unwrap(api.api["industrial-leads"].post(lead), "POST /api/industrial-leads");
}

export interface ContactInput {
  name: string;
  message: string;
  phone?: string;
  email?: string;
}

export async function submitContactMessage(input: ContactInput): Promise<void> {
  await unwrap(api.api.contact.post(input), "POST /api/contact");
}
