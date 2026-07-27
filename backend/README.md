# ZUP TECH Backend

Backend for the ZUP TECH storefront + admin panel (see `../fronend/BACKEND.md`
for the full specification this implements).

**Stack:** [Bun](https://bun.sh) · [Elysia](https://elysiajs.com) ·
[Prisma 7](https://prisma.io) (PostgreSQL) · [Better Auth](https://better-auth.com)

## Quick start

```bash
bun install
cp .env.example .env        # fill in DATABASE_URL + BETTER_AUTH_SECRET
bun run db:migrate          # apply migrations (dev)
bun run db:seed             # demo catalog, staff, orders…
bun run dev                 # http://localhost:3000
```

Demo staff logins (password `zup123`): `arif` (Super Admin), `nusrat`
(Manager), `rakib` (Support).

### Scripts

| Script | What it does |
|---|---|
| `bun run dev` | Dev server with watch/reload |
| `bun run start` | Production start |
| `bun test` | Unit tests (business rules) |
| `bun run db:migrate` | Create/apply migrations (development) |
| `bun run db:deploy` | Apply committed migrations (production/CI) |
| `bun run db:seed` | Idempotent demo seed |
| `bun run db:studio` | Prisma Studio data browser |

### Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Production uses the hosting provider's **internal** host (only resolves inside its private network); local dev currently points at a temporary [Prisma Postgres](https://prisma.io/postgres) instance — claim it or swap in your own. |
| `BETTER_AUTH_SECRET` | Session signing secret — `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | Public base URL of this backend |
| `PORT` | Listen port (default 3000) |
| `CORS_ORIGINS` | Comma-separated allowed origins (the storefront) |

## Architecture

```
src/
  index.ts              app composition: CORS, security headers, error → JSON
  lib/
    db.ts               shared PrismaClient (pg driver adapter)
    auth.ts             Better Auth: staff username+password, customer phone+password
    rbac.ts             module/permission matrix + assertCan()
    rules.ts            business rules (phone, delivery fee, stock, GTM, masking)
    order-stock.ts      order status ⇄ inventory transitions + audit movements
    serialize.ts        DB row → API payload mappers (per-audience field control)
    ids.ts              sequential ZT-/PO- ids (Counter table, transactional)
    http.ts             ApiError + helpers
    rate-limit.ts       in-memory limiter for login/register/password-reset
  routes/
    public/             /api/* storefront + /pay/* webhooks
    admin/              /admin/api/* (staffGuard session + per-route assertCan)
prisma/
  schema.prisma         all models incl. Better Auth tables
  seed.ts               demo data ported from the frontend prototype
```

**Auth model.** Better Auth owns credentials and sessions (httpOnly cookies).
Staff = `username` plugin + a `Staff` row linking the auth user to a `Role`;
customers sign in with phone + password — Better Auth still needs an email
internally, so phone maps to a deterministic synthetic address
(`lib/rules.ts` `customerEmail`, never sent anywhere). Guest checkout still
auto-creates a `Customer` row by phone with no account attached; registering
links a real login to that identity. Password reset uses Better Auth's
official `emailOTP` plugin (6-digit code, 10-minute TTL, 5 attempts,
single-use — atomic verify/consume) rather than a link/token. While no SMS
gateway is wired up, `/api/auth/forgot-password` echoes a `devToken` outside
production and logs it on the server.

**RBAC.** Every `/admin/api/*` route resolves the staff session, then checks
the role's `{module: none|view|manage}` matrix server-side (`assertCan`).
Invariants enforced: Super Admin role immutable, self-deletion blocked, roles
with staff undeletable, usernames unique.

**Inventory.** `available = stock − reserved`. Checkout reserves units;
`Delivered` consumes them (stock ↓, sold ↑, StockMovement logged);
`Cancelled` releases; reverting a status puts everything back — see
`lib/order-stock.ts`.

## API surface

Interactive OpenAPI docs (Scalar UI) are served at **`/openapi`** and the raw
OpenAPI 3 spec at **`/openapi/json`** — generated from the DTO schemas in
`src/dtos/`, grouped by tag (Storefront, Checkout, Admin · …).

### Public (storefront)

| Endpoint | Notes |
|---|---|
| `GET /api/products` | Visible products only; `?section=` and `?category=` filter by name |
| `GET /api/products/:slug` | 404 for hidden/unknown |
| `GET /api/sections` | Catalog taxonomy: sections with their categories nested (each with `svgLogo` markup) — the storefront's filter tree |
| `GET /api/categories` | Flat category list, each carrying its section name |
| `GET /api/services` | Service cards for /solutions; the `id` is what `POST /api/leads` expects |
| `GET /api/industrial-services` | Industrial/EPC cards; the `id` is what `POST /api/industrial-leads` optionally links against |
| `GET /api/site-config` | Featured ids, slides, copy, contact, `gtm`, payment options — never secrets |
| `POST /api/pricing/quote` | Price a cart for display (`items` + optional `insideDhaka`) — `deliveryFee`/`installationFee`/`total` are `null` until the zone is sent; each line's fee comes straight off the product's inside/outside-Dhaka fields; contract in `../fronend/cal-bk.md` §2.1 |
| `POST /api/orders` | Guest checkout (`cal-bk.md` §2.2): body carries `insideDhaka` + ids/qty only (client money fields ignored), recomputes totals (Σ per-product zone-specific delivery + installation fee × qty), reserves stock, auto-creates/updates customer (name+address+insideDhaka saved for next time), sequential `ZT-` id, rate-limited |
| `GET /api/my/orders` | Requires customer session |
| `GET /api/me` | Session's customer profile incl. saved `address`/`insideDhaka` (or `{customer: null}`) — lets the storefront prefill checkout |
| `PATCH /api/me` | Edit the saved profile (`name`/`address`/`insideDhaka`) directly; requires customer session |
| `GET /api/cart` / `PUT /api/cart` | Signed-in customer's server-synced cart (`items: [{productId, qty}]`) — survives across devices, not just localStorage |
| `POST /api/auth/register` | Create a customer account (`name`, `phone`, `password`), signs in |
| `POST /api/auth/login` | Phone + password login (rate-limited) |
| `POST /api/auth/forgot-password` | Request a 6-digit password-reset OTP for a phone (no enumeration; rate-limited) |
| `POST /api/auth/reset-password` | Set a new password from `phone` + `otp` |
| `POST /api/auth/logout` | Clear customer session |
| `POST /api/leads` | Home-service booking form on /services — takes a `serviceId` (404 if unknown), not free text |
| `POST /api/industrial-leads` | Industrial enquiry form on /industrial — B2B fact set (company, sector, scope, timeline, connected load). `industrialServiceId` is optional and best-effort: an id with no row behind it stores an unlinked lead rather than 404ing, because the page can render a static fallback list. `sector`/`scope`/`timeline` are closed vocabularies (`INDUSTRIAL_SECTORS`/`_SCOPES`/`_TIMELINES` in `lib/rules.ts`) |
| `GET /api/landing-pages/:slug` | Public campaign page (`/lp/:slug`). 404s for unknown **and** unpublished slugs, so a draft stays genuinely unlisted. Embeds the full product, which is how a campaign renders a product that is off the storefront. Increments `viewCount` |
| `GET /api/page-heroes` | Hero art for every page, keyed by `pageKey`. Pages never edited come back `mode: "plain"` (the frontend's built-in design) |
| `POST /api/contact` | Contact form |
| `POST /pay/:provider` | Gateway webhook **stubs** (bkash/nagad/card) — signature verification TODO before go-live |

### Admin (`/admin/api`, staff session + RBAC)

| Area | Endpoints |
|---|---|
| Auth | `POST /login`, `POST /logout`, `GET /me` |
| Dashboard | `GET /metrics?period=week\|month\|year` — KPIs, 14-day revenue, series vs previous period, revenue split by section |
| Orders | `GET /orders?q=&status=&preparedById=` (`preparedById=none` lists unclaimed), `GET /orders/:id` (lines + audit trail + invoice + warranties), `PATCH /orders/:id {status?, preparedById?}` — every change is written to the order's `OrderEvent` trail; reaching `Delivered` also generates the warranty records |
| Invoices | `GET /invoices?q=&status=`, `GET /invoices/:id`, `POST /invoices {orderId, notes?}` (one per order, 409 otherwise), `PATCH /invoices/:id {status?, notes?}`. No DELETE — a raised invoice is `Void`ed. Amounts are derived from the order, never stored twice |
| Warranty | `GET /warranties?q=&status=`, `POST /warranties {orderId}` (idempotent backfill for orders delivered before the registry existed; 400 unless delivered), `PATCH /warranties/:id {serialNo?, status?, claimNote?, months?}` |
| Products | `GET/POST /products`, `PATCH/DELETE /products/:id`, `PATCH /products/featured {ids}` — delivery/installation fees (`deliveryFeeInsideDhaka`/`deliveryFeeOutsideDhaka`/`installationFeeInsideDhaka`/`installationFeeOutsideDhaka`) are edited per-product, no separate pricing area |
| Inventory | `PATCH /stock/:productId {onHand, reason}`, `GET/POST /purchase-orders`, `POST /purchase-orders/:id/receive\|cancel`, suppliers CRUD, `GET /movements` |
| Taxonomy | `GET/POST /sections`, `PATCH/DELETE /sections/:id`, `GET/POST /categories`, `PATCH/DELETE /categories/:id`, `PUT /categories/:id/logo {svg}` — per-item CRUD (`products` module). Deletes 409 while categories/products still reference the row |
| Leads/customers | `GET /leads`, `PATCH /leads/:id {status}`, `DELETE /leads/:id`, `GET /customers?q=`, `GET /messages`, `PATCH/DELETE /messages/:id` |
| Industrial leads | `GET /industrial-leads?status=&sector=`, `PATCH /industrial-leads/:id {status}`, `DELETE /industrial-leads/:id` — same `leads` module permission as above, but a separate pipeline: statuses are `INDUSTRIAL_LEAD_STATUSES` (New/Qualifying/Site survey/Proposal sent/Negotiation/Won/Lost), not `LEAD_STATUSES` |
| Content | `GET/PUT /slides`, `POST /slides/image`, `PUT /copy`, `PUT /contact`, `PUT /integrations` |
| Landing pages | `GET /landing-pages?published=`, `GET/PATCH/DELETE /landing-pages/:id`, `POST /landing-pages`, `POST /landing-pages/:id/publish\|unpublish\|duplicate` (`landingpages` module). `title` is the internal admin name and never reaches the public payload; `headline` is the public <h1> and falls back to the product name when blank. Publishing an off-catalogue product's page is what makes that product orderable — see `orderableProductWhere()` in `lib/rules.ts`. `offerPrice` is ad copy; checkout still reprices from the catalog |
| Page heroes | `GET /page-heroes`, `PUT /page-heroes/:pageKey {mode, overlay, background?}`, `POST /page-heroes/:pageKey/background\|posters` (multipart), `PATCH/DELETE /hero-posters/:id`, `PUT /page-heroes/:pageKey/posters/order {ids}` (`sitecontent` module). `pageKey` must be one of `PAGE_HERO_KEYS`; rows are created lazily on first edit |
| Services | `GET/POST /services`, `PATCH/DELETE /services/:id`, `POST /services/:id/image`, and the same set under `/industrial-services` (`sitecontent` module). Deleting a service with leads attached 409s; deleting an industrial service instead nulls the link on its `IndustrialLead` rows (the enquiry keeps its `serviceName` snapshot) |
| Payments | `GET /payment-methods`, `PUT /payment-methods/:id` (secrets write-only, responses masked) |
| Staff | staff CRUD, roles CRUD with permission matrix |

Errors are always `{ "error": "message" }` with a meaningful status
(400/401/403/404/409/422/429).

## Production checklist

- [ ] Set a strong `BETTER_AUTH_SECRET`; real `DATABASE_URL`; `NODE_ENV=production`
- [ ] `bun run db:deploy && bun run db:seed` on first deploy
- [ ] Wire an SMS gateway into `sendVerificationOTP` (src/lib/auth.ts) — dev token echo turns off automatically in production
- [ ] Implement real gateway verification in `routes/public/webhooks.ts` + a payment-initiation step
- [ ] Move product photos to object storage (currently URL/data-URL strings)
- [ ] Change the seeded demo staff passwords
- [ ] Put the API behind TLS and restrict CORS_ORIGINS to the real storefront origin
