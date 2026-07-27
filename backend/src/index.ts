import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";
import { ApiError } from "./lib/http";
import { adminAuth } from "./routes/admin/auth";
import { adminContent } from "./routes/admin/content";
import { adminInventory } from "./routes/admin/inventory";
import { adminInvoices } from "./routes/admin/invoices";
import { adminLandingPages } from "./routes/admin/landing-pages";
import { adminLeadsCustomers } from "./routes/admin/leads-customers";
import { adminPageHeroes } from "./routes/admin/page-heroes";
import { adminMetrics } from "./routes/admin/metrics";
import { adminOrders } from "./routes/admin/orders";
import { adminPayments } from "./routes/admin/payments";
import { adminProducts } from "./routes/admin/products";
import { adminServices } from "./routes/admin/services";
import { adminStaff } from "./routes/admin/staff";
import { adminTaxonomy } from "./routes/admin/taxonomy";
import { adminWarranty } from "./routes/admin/warranty";
import { customerAuth } from "./routes/public/auth";
import { publicCart } from "./routes/public/cart";
import { publicLandingPages } from "./routes/public/landing-pages";
import { publicLeads } from "./routes/public/leads";
import { publicPageHeroes } from "./routes/public/page-heroes";
import { publicOrders } from "./routes/public/orders";
import { publicPricing } from "./routes/public/pricing";
import { publicProducts } from "./routes/public/products";
import { publicServices } from "./routes/public/services";
import { publicTaxonomy } from "./routes/public/taxonomy";
import { siteConfig } from "./routes/public/site-config";
import { paymentWebhooks } from "./routes/public/webhooks";

/**
 * ZUP TECH backend — Elysia on Bun.
 *
 * Route map:
 *   /api/*        public storefront (products, site-config, checkout, customer login)
 *   /pay/*        payment gateway webhooks
 *   /admin/api/*  staff panel (session + per-module RBAC on every route)
 */
const app = new Elysia()
  .use(
    cors({
      origin: (process.env.CORS_ORIGINS ?? "").split(",").filter(Boolean),
      credentials: true, // session cookies cross the storefront ↔ API origin
    }),
  )

  // Interactive API docs (Scalar UI) at /openapi, raw spec at /openapi/json.
  // Request schemas come straight from the DTOs in src/dtos/*.dto.ts.
  .use(
    openapi({
      path: "/openapi",
      documentation: {
        info: {
          title: "ZUP TECH API",
          version: "1.0.0",
          description:
            "Backend for the ZUP TECH storefront + admin panel. " +
            "`/api/*` is the public storefront, `/pay/*` payment webhooks, " +
            "`/admin/api/*` the staff panel (session cookie + per-module RBAC). " +
            "All money is integer BDT and always computed server-side — see " +
            "`cal-bk.md` for the pricing contract. Storefront validation " +
            "errors return 400 `{ error }`; admin routes return 422.",
        },
        tags: [
          { name: "Storefront", description: "Public catalog & site config" },
          { name: "Checkout", description: "Cart pricing quotes + guest checkout (cal-bk.md)" },
          { name: "Customer auth", description: "Phone + password login for order tracking" },
          { name: "Customer cart", description: "Signed-in customer's server-synced cart" },
          { name: "Leads", description: "Booking & contact forms" },
          { name: "Webhooks", description: "Payment gateway callbacks (stubs)" },
          { name: "Admin · Auth", description: "Staff login/logout/session" },
          { name: "Admin · Metrics", description: "Dashboard & analytics" },
          { name: "Admin · Orders", description: "Order list, detail, status & prepared-by" },
          { name: "Admin · Invoices", description: "Order invoices (Draft → Issued → Paid)" },
          { name: "Admin · Warranty", description: "Warranty registry & claims" },
          { name: "Admin · Products", description: "Catalog CRUD + featured row" },
          { name: "Admin · Taxonomy", description: "Sections & categories (with logos)" },
          { name: "Admin · Services", description: "Service & industrial-service catalogues" },
          { name: "Admin · Inventory", description: "Stock, purchase orders, suppliers, movements" },
          { name: "Admin · Leads & Customers", description: "Lead pipeline + customer list" },
          { name: "Admin · Content", description: "Hero slides, copy, contact, integrations" },
          { name: "Admin · Payments", description: "Payment method config (secrets masked)" },
          { name: "Admin · Staff", description: "Staff & role management (RBAC)" },
        ],
      },
    }),
  )

  // Baseline security headers on every response (mirrors next.config.ts).
  .onAfterHandle(({ set }) => {
    set.headers["x-content-type-options"] = "nosniff";
    set.headers["x-frame-options"] = "DENY";
    set.headers["referrer-policy"] = "strict-origin-when-cross-origin";
    set.headers["permissions-policy"] = "camera=(), microphone=(), geolocation=()";
  })

  // One place turns thrown errors into JSON — handlers just throw ApiError.
  .onError(({ error, code, set, request }) => {
    if (error instanceof ApiError) {
      set.status = error.statusCode;
      return { error: error.message };
    }
    if (code === "VALIDATION") {
      // Storefront contract (cal-bk.md §2) promises 400 + { error: reason }
      // for any invalid input; the admin panel keeps 422 with full detail.
      if (!new URL(request.url).pathname.startsWith("/admin/")) {
        set.status = 400;
        return { error: error.all?.[0]?.summary ?? "Invalid request" };
      }
      set.status = 422;
      return { error: "Invalid request", detail: error.message };
    }
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Not found" };
    }
    console.error("[unhandled]", error);
    set.status = 500;
    return { error: "Something went wrong" };
  })

  .get("/health", () => ({ ok: true, service: "zuptech-backend" }))

  // Public storefront
  .use(publicProducts)
  .use(publicTaxonomy)
  .use(publicServices)
  .use(siteConfig)
  .use(publicPricing)
  .use(publicOrders)
  .use(customerAuth)
  .use(publicCart)
  .use(publicLeads)
  .use(publicLandingPages)
  .use(publicPageHeroes)
  .use(paymentWebhooks)

  // Admin panel
  .use(adminAuth)
  .use(adminMetrics)
  .use(adminOrders)
  .use(adminInvoices)
  .use(adminWarranty)
  .use(adminProducts)
  .use(adminTaxonomy)
  .use(adminInventory)
  .use(adminLeadsCustomers)
  .use(adminLandingPages)
  .use(adminPageHeroes)
  .use(adminContent)
  .use(adminServices)
  .use(adminPayments)
  .use(adminStaff)

  .listen(Number(process.env.PORT ?? 3000));

console.log(`🦊 ZUP TECH backend running at http://${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
