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

- Prisma 7: connection URL lives in `prisma.config.ts` (from `DATABASE_URL`),
  client is generated to `src/generated/` (gitignored — regenerate after
  schema changes) and instantiated with the `@prisma/adapter-pg` driver
  adapter in `src/lib/db.ts`. Import `prisma` from there, never `new PrismaClient()`.
- Better Auth (`src/lib/auth.ts`) handles both audiences: staff via the
  `username` plugin, customers via phone + password (mapped to a synthetic
  email internally). Its tables (User,
  Session, Account, Verification) are part of `schema.prisma`.
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
- `PageHero`/`HeroPoster` back the per-page hero art and are created lazily —
  a page with no row renders the frontend's built-in design (`mode: "plain"`).
  Distinct from `HeroSlide`, which is the homepage promo carousel.
- `Category.svgLogo` holds SVG **markup**, not a URL — the media-storage
  service only accepts raster formats and rasterizes what it stores. The
  storefront renders it inline, so it goes through `sanitizeSvgLogo`
  (`src/lib/rules.ts`), which rejects anything active. Never widen that
  allowlist without re-reading the tests in `rules.test.ts`.
- Order status ⇄ stock effects go through `applyStatusTransition`
  (`src/lib/order-stock.ts`) so StockMovement audit rows stay consistent.
- Status fields are strings (not Prisma enums) to keep payloads identical to
  the frontend types ("On the way" etc.); validated with Elysia `t` unions.
- Money is integer BDT throughout.
- Product photos/video and hero slide images are files on the standalone
  media-storage service (`../storage`, its own repo — see its README for the
  full HTTP contract), not base64 blobs. `src/lib/storage.ts` wraps its API;
  admin upload routes (`POST /admin/api/products/:id/photos|video`,
  `POST /admin/api/slides/image`) proxy the multipart file through with the
  shared `X-API-Key`, which stays server-side, and store the returned file
  URL on the row. `GET /files/...` is public/unauthed, so the browser reads
  media directly from the storage service.

## Environment

`.env` (gitignored): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`PORT`, `CORS_ORIGINS`, `STORAGE_URL`, `STORAGE_API_KEY` (the last two point
at the media-storage service — see its own `.env`/README for how to run it
locally). Local dev points at a temporary Prisma Postgres instance;
production uses the hosting provider's internal Postgres URL (only resolves
inside its network) — see `.env.example`.

Demo staff (password `zup123`): arif/super, nusrat/manager, rakib/support.
