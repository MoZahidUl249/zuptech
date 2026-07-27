# landing-pages — Single-Product Campaign Pages

> **STATUS (2026-07-27):** live on the real backend. The `LandingPage` Prisma
> model, the admin CRUD under `/admin/api/landing-pages` and the public
> `GET /api/landing-pages/:slug` all ship in `../backend`. The former
> in-memory reference store (`lib/landing-pages-store.ts`) and its local Route
> Handlers under `app/admin/api/landing-pages/*` and `app/api/landing-pages/*`
> have been **deleted** — with them gone, `next.config.ts`'s `/admin/api/:path*`
> rewrite reaches the backend, so the clean REST shape described below is what
> `lib/admin-landing-pages.ts` actually calls. Nothing resets on restart any
> more.
>
> **Why this feature exists:** campaigns are hyperlinked from Facebook ads, and
> some products are deliberately *not* live on the storefront — the landing
> page is the only place they can be bought. That is enforced by
> `orderableProductWhere()` in `../backend/src/lib/rules.ts`: a product is
> purchasable when it is `visible` **or** carried by at least one *published*
> landing page. Unpublishing the last page carrying an off-catalogue product
> closes checkout for it again.
>
> **Headline vs title:** `title` is the internal admin name (the list label)
> and is stripped from the public payload entirely. `headline` is the `<h1>`
> visitors see and falls back to the product name when blank — otherwise a
> page created from "New landing page" would advertise that literal string to
> ad traffic.
>
> **Money:** `offerPrice`/`compareAtPrice` are ad copy. Checkout still reprices
> from the catalog via `priceCart()` (cal-bk.md §3), so a landing page can
> never move real money on its own. The admin editor shows the product's real
> selling price and warns when the two diverge — if you want the advertised
> price to be charged, set the product's sale price to match.

## 1. What this feature is

Unlisted, single-product campaign pages for ad traffic (e.g. Facebook ads,
promo links) — never linked from the store nav, never in the sitemap, never
crawlable. Each page:

- Has its own share link (`/lp/:slug`) — the only way in.
- Has its own GTM container, so ad spend is tracked separately from the main
  site's GTM.
- Shows an offer price, a struck-through compare-at price, a derived
  discount %, a benefit-bullet checklist, and reuses the normal product
  add-to-cart/buy-now flow — orders it generates land in the same Orders
  pipeline as every other order.

## 2. Data model

```
LandingPage
  id                String   PK
  title             String   — internal name, shown in the admin list
  slug              String   unique — the /lp/:slug path segment
  productId         String   FK → Product
  offerPrice        Int      — admin-entered, BDT
  compareAtPrice    Int      — admin-entered, BDT (struck-through reference price)
  ribbonText        String   — urgency banner, e.g. "Limited stock — offer ends today"
  buttonLabel       String   — overrides the default "Buy Now" label
  footerNote        String   — small print under the order button
  benefitBullets    String[] — checklist shown above the order button
  imageHint         String   — placeholder label (no real image pipeline yet)
  gtmId             String   — this page's own GTM-XXXXXXX container id
  published         Boolean  — false = 404 on the public route
  viewCount         Int      — server-incremented on each public GET
  orderCount        Int      — see §4, attribution is still an open question
  createdAt         DateTime
  updatedAt         DateTime
```

## 3. Endpoints the backend must serve (exact contract)

Reference implementations (same shapes) are in this repo — replace them,
keep the paths:

- `app/admin/api/landing-pages/route.ts` — `GET` (list), `POST` (create)
- `app/admin/api/landing-pages/[id]/route.ts` — `GET`, `PATCH`, `DELETE`
- `app/admin/api/landing-pages/[id]/publish/route.ts` — `POST`
- `app/admin/api/landing-pages/[id]/unpublish/route.ts` — `POST`
- `app/admin/api/landing-pages/[id]/duplicate/route.ts` — `POST`
- `app/api/landing-pages/[slug]/route.ts` — `GET` (public)
- `lib/landing-pages-store.ts` — the reference "business logic" (slug
  uniqueness, discount computation) to port into the real backend

### 3.1 Admin CRUD (`/admin/api/landing-pages*`)

Same auth/session model as every other `/admin/api/*` endpoint (better-auth
staff cookie, RBAC by role). Request/response bodies mirror the
`LandingPage` shape above minus server-owned fields (`id`, `createdAt`,
`updatedAt`, `viewCount`, `orderCount` are never accepted from the client).

A new `"landingpages"` key must be added to the admin permission model
(`AdminModule`/`Role.permissions` in `BACKEND.md`'s staff/roles section) so
`GET /admin/api/me`'s `permissions` object includes it. Until then, the
frontend defaults every signed-in staff member to `"manage"` for this one
module (see the comment in `lib/admin.tsx`'s `can()`) — remove that
fallback once this ships.

### 3.2 Public read (`GET /api/landing-pages/:slug`)

Response `200` — **note the two computed fields**:

```json
{
  "id": "lp1",
  "title": "IPS 1000VA — ঈদ অফার",
  "slug": "ips-1000-offer",
  "productId": "ips1000",
  "offerPrice": 38900,
  "compareAtPrice": 44150,
  "discountPercent": 12,
  "youSave": 5250,
  "ribbonText": "সীমিত স্টক · অফার আজই শেষ",
  "buttonLabel": "অর্ডার করুন",
  "footerNote": "হটলাইন ০৯৬৭৮-১০০২০০ · সকাল ৯টা – রাত ৮টা",
  "benefitBullets": ["…"],
  "imageHint": "আইপিএস ও ব্যাটারির ছবি",
  "gtmId": "GTM-ZUPLP01",
  "published": true,
  "viewCount": 1843,
  "orderCount": 37,
  "product": { "id": "ips1000", "slug": "1000va-ips-battery-combo", "name": "…", "price": 42500, "specs": [...], "description": "…" }
}
```

Response `404` for both unknown slugs and unpublished pages — **identical
response body**, so an unpublished page's existence can't be probed for
from the outside.

Per `cal-bk.md`'s "zero money math in the browser" rule: `discountPercent`
and `youSave` are **derived from admin-entered data**
(`offerPrice`/`compareAtPrice`), and that derivation must happen
server-side and ship as ready-made fields — the frontend renders them, it
never recomputes them. `offerPrice`/`compareAtPrice` themselves are plain
admin input, not a calculation, so entering them in the admin form is fine.

This endpoint must also increment `viewCount` server-side on each call
(the reference implementation does this synchronously in the GET handler;
the real backend may prefer a cheaper async/batched counter, as long as the
count is never trusted from the client).

## 4. Open question: order attribution

Today, `POST /api/orders` (see `cal-bk.md` §2.2) has no field connecting an
order back to the landing page that generated it — `orderCount` in the
reference store is never actually incremented by a real order, only by the
`duplicate`/manual-testing paths. Before this ships for real, decide:

- Add an optional `landingPageId` (or `slug`) to `createOrderDto`, so the
  backend can increment the matching `LandingPage.orderCount` at order time
  (`app/lp/[slug]/page.tsx` would need to thread the slug through
  `ProductActions` → `useCart()` → checkout), **or**
- Treat `orderCount` as GTM/ads-platform-reported only, decoupled from the
  Orders pipeline, and drop the field (or keep it purely advisory).

## 5. Things intentionally NOT built yet

- No real image upload — `imageHint` is a text placeholder label, same
  convention as the product-photo placeholders used elsewhere before a
  media pipeline existed.
- No admin-manageable A/B variants, scheduling, or expiry dates.
- No rate limiting on the public view-count increment (matches the rest of
  this repo's current state — see `BACKEND.md` §6 for the standing
  rate-limiting note that applies everywhere).
