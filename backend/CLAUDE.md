# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Backend for the ZUP TECH storefront + admin panel: Bun + Elysia + Prisma 7
(PostgreSQL) + Better Auth. The spec it implements lives in
`../fronend/BACKEND.md`; the README documents the full API surface.

Route map: `/api/*` public storefront, `/pay/*` payment webhooks,
`/admin/api/*` staff panel (session + per-module RBAC).

## Commands

- **Install:** `bun install`
- **Dev server (watch):** `bun run dev` — http://localhost:3000
- **Tests:** `bun test`
- **Typecheck:** `bunx tsc --noEmit`
- **DB:** `bun run db:migrate` (dev), `bun run db:deploy` (prod),
  `bun run db:seed` (idempotent demo data), `bun run db:studio`

Use `bun` (not npm/node) everywhere; run Prisma CLI as `bunx --bun prisma …`.

## Architecture notes

- The app is *assembled* in `src/app.ts` and *started* in `src/index.ts`.
  Nothing in app.ts has an import side effect, which is what lets
  `src/app.test.ts` hold a fully-wired app — every route, every DTO, the
  staffGuard and the onError hook — and drive real Requests through
  `app.handle()` with no port and no database. Those route tests replace only
  `lib/db` and `lib/auth`, so a new endpoint is covered by the RBAC and
  400/422 assertions the moment it is mounted. Keep new composition (hooks,
  headers, plugins) in app.ts; index.ts should stay four lines.
- Prisma 7: connection URL lives in `prisma.config.ts` (from `DATABASE_URL`),
  client is generated to `src/generated/` (gitignored — regenerate after
  schema changes) and instantiated with the `@prisma/adapter-pg` driver
  adapter in `src/lib/db.ts`. Import `prisma` from there, never `new PrismaClient()`.
- Better Auth (`src/lib/auth.ts`) handles both audiences: staff via the
  `username` plugin, customers via phone + password (mapped to a synthetic
  email internally). Its tables (User,
  Session, Account, Verification) are part of `schema.prisma`.
- There are **two kinds of email address** and conflating them breaks sign-in.
  `User.email` is the synthetic *identifier* Better Auth authenticates against
  (`{phone}@customers.zuptech.local`, `{username}@staff.zuptech.local` — see
  `customerEmail`/`staffEmail` in `lib/rules.ts`); it is unique, required, and
  never deliverable. `Customer.email` / `Staff.email` are the real inboxes,
  nullable, and used only as a *destination* for password-reset codes. The
  forgot/reset routes look an account up by the real address; the emailOTP
  plugin's `sendVerificationOTP` goes the other way, via `parseInternalEmail`,
  to find where to deliver. Never repoint `User.email` at a real address.
- `src/lib/mail.ts` is the only outbound-mail path (SMTP via `nodemailer`).
  With `SMTP_HOST` unset it logs instead of sending, which is how the reset
  flow is exercised in dev — a log line, never a response field. Reset
  endpoints always answer `{ok: true}` regardless of whether the account
  exists, so nothing in the API can be used to enumerate accounts.
- A product carries two offer ladders, both `{minQty, amount}` relations with
  `@@unique([productId, minQty])`: `QuantityOffer` (BDT off the unit price) and
  `FreeDeliveryOffer` (BDT off the zone delivery fee). Both resolve the same
  way — highest satisfied `minQty` wins, tiers never stack — through
  `bestOfferTier` in `lib/rules.ts`. Admin writes are replace-all per ladder.
  When adding a third ladder, reuse `bestOfferTier` rather than writing another
  search.
- **Every discount is a flat BDT amount; there are no percentages in the money
  path.** They were removed because the same percentage got rounded three
  different ways — the server floored it, the admin preview rounded it, the
  product card rounded again off a different base — so a ৳999 product at 33%
  off showed ৳669 in the admin and charged ৳670. `Product.salePrice` is what
  the customer pays (admin-entered, not derived). Subtraction has nothing to
  round. A tier may exceed the price or the fee: `effectiveUnitPrice` and
  `discountedDeliveryFee` clamp at zero, and an amount at or above the zone fee
  is how "free delivery" is expressed.
- **`Product.minDepositPct` is the one percentage, and it is display-only.** It
  was `minDeposit` in BDT until 2026-08-13. Nothing in pricing, order creation
  or checkout reads it — the storefront just prints "20% minimum down payment".
  That is the only reason a percentage is tolerable here. If checkout ever
  takes deposits, resolve it to taka **once**, server-side, and store that
  number on the order; do not recompute the percentage in two places, which is
  exactly what the paragraph above is about.
- `Product.recommendedIds` and `SiteConfig.featuredIds`/`homeRowIds` are all
  ordered arrays of product ids, not relations. An id that stops resolving is
  dropped silently (`getProductsByIds` on the storefront, and the admin picker
  filters the catalogue), so a deleted product costs one missing card rather
  than a broken page. The two SiteConfig rows are validated on write against
  the catalogue (`assertKnownProducts`); a product's own recommendations are
  not, because rejecting a product save over an unrelated deletion is worse
  than one absent card.
- Admin routes `.use(staffGuard)` (session → `staffCtx`) and call
  `assertCan(staffCtx, module, "view"|"manage")` at the top of every handler.
- Request/response contracts are DTOs: every route body/query schema lives in
  `src/dtos/*.dto.ts` (Elysia `t` schema + inferred `.static` type — never
  inline schemas in routes), and `src/lib/serialize.ts` mappers are annotated
  with the response interfaces in `src/dtos/responses.ts`.
- Business rules (delivery fee, phone regex, stock math, secret masking, SVG
  logo sanitizing) are centralized in `src/lib/rules.ts` — change behavior
  there, not inline.
- Catalog taxonomy is `Section → Category → Product`: a product belongs to
  exactly one category, and its section is reached through that category
  (there is no `cat`/`tags` column any more). `Category.name` is globally
  unique, so a category lives under exactly one section. Every product query
  must spread `productInclude` (`src/lib/serialize.ts`) — the mappers can't
  serialize a product without its category + section loaded.
- The service pages are backed by two models: `Service` (booked via
  `ServiceLead`, from the /services form) and `IndustrialService` (booked via
  `IndustrialLead`, from the /industrial form). Both are per-item CRUD, not
  whole-document PUTs, because each row owns uploaded media keyed on its id.
- The two lead types are deliberately separate models, not one table with a
  flag: an industrial enquiry captures a different fact set (company, sector,
  connected load, scope, budget) and runs its own pipeline
  (`INDUSTRIAL_LEAD_STATUSES`, not `LEAD_STATUSES`). They share the `leads`
  RBAC module but have separate endpoints and separate admin screens. Note the
  asymmetry in how each resolves its service: `POST /api/leads` 404s on an
  unknown `serviceId`, while `POST /api/industrial-leads` links only when the
  id resolves and always stores the `serviceName` snapshot — /industrial can
  render a static fallback list whose ids have no row behind them, and losing
  a qualified B2B enquiry to a stale id is worse than storing it unlinked.
- A product is *listed* and a product is *orderable* are two different
  questions. `GET /api/products` filters on `visible: true`; whether a cart
  line may be bought goes through `orderableProductWhere()` (`lib/rules.ts`),
  which also admits products carried by a **published** `LandingPage`. That is
  what lets a Facebook-ad campaign sell something deliberately kept off the
  storefront. Spread that helper into any new query that gates a purchase —
  don't re-check `visible` inline.
- Landing-page `offerPrice`/`compareAtPrice` are ad copy, never money the
  server acts on: checkout always reprices through `priceCart()`. The admin
  surfaces `productSellingPrice` beside the offer so a campaign advertising a
  price the cart won't honour is visible before it ships.
- `HeroSlide` is the only hero model: the homepage promo carousel, which
  `/services` and `/industrial` render too. A per-page `PageHero`/`HeroPoster`
  pair used to exist alongside it and was dropped in the site-content cleanup —
  no page had rendered that art since the storefront was rebuilt, so the whole
  cluster (7 admin routes, a public route, an editor) was write-only.
- A `SiteConfig` copy column earns its place by having a renderer. Twenty-one
  were dropped for failing that test; `serialize.test.ts` pins the surviving
  set so the next deleted section takes its column with it.
- `Category.svgLogo` holds SVG **markup**, not a URL — the media
  service only accepts raster formats and rasterizes what it stores. The
  storefront renders it inline (`dangerouslySetInnerHTML`), so it goes through
  `sanitizeSvgLogo` (`src/lib/rules.ts`). That function **parses** the markup
  with cheerio and allowlists elements and attributes, then re-serializes what
  it validated; it does not pattern-match the source string. It used to, and
  the blocklist was bypassable three ways at once (`<rect/onmouseover=…>`,
  `<rect id="a"onmouseover=…>`, `&#106;avascript:`) — all now regression tests
  in `rules.test.ts`. Add elements/attributes to the two allowlists if a real
  logo needs them; never reintroduce a "reject these patterns" check.
- Admin RBAC has three escalation guards that are easy to drop when editing
  `routes/admin/staff.ts`: a non-Super-Admin can't edit or delete a staff
  member whose role `isSystem`, nobody can change their own `roleId`, and
  `assertCanGrant` (`lib/rbac.ts`) refuses to put access into a role that the
  caller doesn't hold. Without all three, `staff: manage` silently implies
  every other permission. A module belongs in `ADMIN_MODULES` only if some
  route actually passes it to `assertCan`/`assertCanAny`.
- Rate limiting keys on `clientIp` (`lib/rate-limit.ts`), never on
  `server.requestIP()` directly — the browser reaches this service through the
  Next.js rewrite, so the socket address is one container for the whole
  internet. See the comment there before changing `TRUSTED_PROXY_HOPS`.
- Order status ⇄ stock effects go through `applyStatusTransition`
  (`src/lib/order-stock.ts`) so StockMovement audit rows stay consistent.
- Status fields are strings (not Prisma enums) to keep payloads identical to
  the frontend types ("On the way" etc.); validated with Elysia `t` unions.
- Money is integer BDT throughout.
- Product photos/video and hero slide images are files on Cloudinary, not
  base64 blobs. `src/lib/storage.ts` wraps the Cloudinary SDK; admin upload
  routes (`POST /admin/api/products/:id/photos|video`,
  `POST /admin/api/slides/image`) proxy the multipart file through — the
  file is validated (`src/lib/media-validate.ts`: MIME allow-list + magic-byte
  content sniffing, since a served asset replays whatever type it was
  uploaded as) and re-uploaded with `CLOUDINARY_API_SECRET`, which stays
  server-side — and store the returned Cloudinary delivery URL on the row.
  That URL is a plain `https://res.cloudinary.com/...` link with a fixed
  `f_auto,q_auto[,w_1600,c_limit]` transform baked into the path (never a
  query string), so `deleteMediaByUrl`/`parseCloudinaryRef` can deterministically
  recover the `public_id` to delete later. The browser fetches media directly
  from Cloudinary's CDN, never proxied through this service.

## Environment

`.env` (gitignored): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`PORT`, `CORS_ORIGINS`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
`CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER_PREFIX` (the Cloudinary account
media is stored on — see `.env.example`), plus
`SMTP_HOST`/`SMTP_PORT`/`SMTP_SECURE`/`SMTP_USER`/`SMTP_PASS`/`MAIL_FROM` for
password-reset delivery (leave `SMTP_HOST` empty locally — codes go to the
console). Local dev points at a temporary Prisma Postgres instance;
production uses the hosting provider's internal Postgres URL (only resolves
inside its network) — see `.env.example`.

Demo staff (password `zup123` in development): arif/super, nusrat/manager,
rakib/support. Under `NODE_ENV=production` the seed generates a random password
per account and prints it once instead — see `staffPassword()` in
`prisma/seed.ts`.

Optional: `TRUSTED_PROXY_HOPS` (default 1, see `lib/rate-limit.ts`) and
`OPENAPI_DOCS=true` to serve `/openapi` in production, where it is off.
