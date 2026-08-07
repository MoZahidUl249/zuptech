import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";
import { ApiError } from "./lib/http";
import { newRequestId, reportError } from "./lib/observability";
import { adminAuth } from "./routes/admin/auth";
import { adminContent } from "./routes/admin/content";
import { adminInventory } from "./routes/admin/inventory";
import { adminInvoices } from "./routes/admin/invoices";
import { adminLandingPages } from "./routes/admin/landing-pages";
import { adminLeadsCustomers } from "./routes/admin/leads-customers";
import { adminMetrics } from "./routes/admin/metrics";
import { adminOrders } from "./routes/admin/orders";
import { adminPayments } from "./routes/admin/payments";
import { adminProducts } from "./routes/admin/products";
import { adminServices } from "./routes/admin/services";
import { adminStaff } from "./routes/admin/staff";
import { adminTeam } from "./routes/admin/team";
import { adminTaxonomy } from "./routes/admin/taxonomy";
import { adminWarranty } from "./routes/admin/warranty";
import { customerAuth } from "./routes/public/auth";
import { publicLandingPages } from "./routes/public/landing-pages";
import { publicLeads } from "./routes/public/leads";
import { publicOrders } from "./routes/public/orders";
import { publicPricing } from "./routes/public/pricing";
import { publicProducts } from "./routes/public/products";
import { publicServices } from "./routes/public/services";
import { siteConfig } from "./routes/public/site-config";
import { paymentWebhooks } from "./routes/public/webhooks";

/**
 * ZUP TECH backend — Elysia on Bun.
 *
 * Route map:
 *   /api/*        public storefront (products, site-config, checkout, customer login)
 *   /pay/*        payment gateway webhooks
 *   /admin/api/*  staff panel (session + per-module RBAC on every route)
 *
 * The app is assembled here and started in index.ts. The split exists so the
 * tests can hold a fully-wired app — every route, the DTO validation, the
 * guards, and the error hook that turns a thrown ApiError into its status —
 * and drive real Requests through `app.handle()` without binding a port or
 * touching a database. Nothing here has a side effect on import.
 */

/**
 * The docs describe every admin endpoint, its body schema and its permission
 * requirements — a map of the attack surface, published unauthenticated. It is
 * a development tool, so it is mounted only outside production. Set
 * `OPENAPI_DOCS=true` to bring it back on a staging box.
 */
const DOCS_ENABLED =
  process.env.OPENAPI_DOCS === "true" || process.env.NODE_ENV !== "production";

/**
 * Build the app. `quiet` drops the per-request access log, which is signal on
 * a server and noise in a test run.
 */
export function createApp({ quiet = false }: { quiet?: boolean } = {}) {
  return (
    new Elysia()
      .use(
        cors({
          origin: (process.env.CORS_ORIGINS ?? "").split(",").filter(Boolean),
          credentials: true, // session cookies cross the storefront ↔ API origin
        }),
      )

      // Interactive API docs (Scalar UI) at /openapi, raw spec at /openapi/json.
      // Request schemas come straight from the DTOs in src/dtos/*.dto.ts.
      .use(
        DOCS_ENABLED && !quiet
          ? openapi({
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
                  { name: "Leads", description: "Booking & contact forms" },
                  { name: "Webhooks", description: "Payment gateway callbacks (stubs)" },
                  { name: "Admin · Auth", description: "Staff login/logout/session" },
                  { name: "Admin · Metrics", description: "Dashboard & analytics" },
                  { name: "Admin · Orders", description: "Order list, detail, status & prepared-by" },
                  { name: "Admin · Invoices", description: "Order invoices (Draft → Issued → Paid)" },
                  { name: "Admin · Warranty", description: "Warranty registry & claims" },
                  { name: "Admin · Products", description: "Catalog CRUD + featured row" },
                  { name: "Admin · Taxonomy", description: "Sections & categories (with logos)" },
                  { name: "Admin · Services", description: "Showcase, service & industrial-service catalogues" },
                  { name: "Admin · Inventory", description: "Stock, purchase orders, suppliers, movements" },
                  { name: "Admin · Leads & Customers", description: "Lead pipeline + customer list" },
                  { name: "Admin · Content", description: "Hero slides, copy, contact, integrations" },
                  { name: "Admin · Payments", description: "Payment method config (secrets masked)" },
                  { name: "Admin · Staff", description: "Staff & role management (RBAC)" },
                  { name: "Admin · Team", description: "The people shown on the contact page" },
                ],
              },
            })
          : new Elysia({ name: "openapi-disabled" }),
      )

      // Baseline security headers on every response (mirrors next.config.ts).
      .onAfterHandle(({ set }) => {
        set.headers["x-content-type-options"] = "nosniff";
        set.headers["x-frame-options"] = "DENY";
        set.headers["referrer-policy"] = "strict-origin-when-cross-origin";
        set.headers["permissions-policy"] = "camera=(), microphone=(), geolocation=()";
      })

      /*
       * Access log.
       *
       * There wasn't one: the only console output was the startup banner and
       * `[unhandled]` for uncaught 500s, so every 400, 403, 404, 409 and 422 this
       * service returned left no trace at all. A rejected admin write or a
       * guard-rail conflict was invisible from the server side — you could only
       * see it in the browser, if someone happened to be watching.
       *
       * One line per request, on stdout, where the startup banner already goes.
       * /health is skipped so an uptime probe doesn't bury everything else.
       */
      .onRequest(({ request, store }) => {
        const s = store as { startedAt?: number; requestId?: string };
        s.startedAt = performance.now();
        // Stamped on every request so a 500's log line and the id handed to the
        // caller are the same string.
        s.requestId = newRequestId();
        void request;
      })
      .onAfterResponse(({ request, set, store }) => {
        if (quiet) return;
        const { pathname } = new URL(request.url);
        if (pathname === "/health") return;
        const started = (store as { startedAt?: number }).startedAt;
        const ms = started === undefined ? "?" : `${Math.round(performance.now() - started)}ms`;
        const status = typeof set.status === "number" ? set.status : 200;
        console.log(`${request.method.padEnd(6)} ${pathname.padEnd(44)} ${status}  ${ms}`);
      })

      // One place turns thrown errors into JSON — handlers just throw ApiError.
      .onError(({ error, code, set, request, store }) => {
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
        // Anything reaching here is a fault, not a rejected request. Give it an id,
        // record it with enough context to find, and hand the id back so a report
        // of "it broke" can be traced to one stack.
        const requestId = (store as { requestId?: string }).requestId ?? newRequestId();
        const { pathname } = new URL(request.url);
        reportError({
          requestId,
          method: request.method,
          path: pathname,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        set.status = 500;
        return { error: "Something went wrong", requestId };
      })

      .get("/health", () => ({ ok: true, service: "zuptech-backend" }))

      // Public storefront
      .use(publicProducts)
      .use(publicServices)
      .use(siteConfig)
      .use(publicPricing)
      .use(publicOrders)
      .use(customerAuth)
      .use(publicLeads)
      .use(publicLandingPages)
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
      .use(adminContent)
      .use(adminServices)
      .use(adminPayments)
      .use(adminStaff)
      .use(adminTeam)
  );
}
