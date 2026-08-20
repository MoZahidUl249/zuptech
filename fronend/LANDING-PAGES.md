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
> **Money:** `offerPrice`/`compareAtPrice` are still ad copy — `priceCart()`
> never reads either, so a number typed beside a headline cannot move a total.
>
> A campaign **can** charge its own bulk prices, through `LandingPageTier`
> (`{minQty, unitPrice}`): absolute per-unit prices the server reads, not
> discounts and not copy. No tiers means the page prices exactly like the shop,
> so the feature is opt-in and adds nothing to a campaign that ignores it. A
> tier at or above the shop price is inert — ad traffic never pays more than a
> walk-in.
>
> Both the advertised ladder and the charged price resolve through
> `campaignUnitPrice()`, and `backend/src/lib/campaign-pricing.test.ts` asserts
> the two are equal for every row the page draws. That equality is the whole
> contract: a campaign cannot advertise a total the cart will refuse.
>
> Setting tiers here does **not** touch the storefront. The product keeps its
> own sale price and its own `quantityOffers`, which is what `/products/:slug`
> and ordinary checkout use.

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
  offerPrice        Int      — admin-entered, BDT. NOT rendered any more (§2.1)
  compareAtPrice    Int      — admin-entered, BDT. The struck price beside the live one
  ribbonText        String   — retained, no longer rendered (§2.1)
  buttonLabel       String   — overrides the default "Buy Now" label
  footerNote        String   — small print under the order button
  benefitBullets    String[] — retained, no longer rendered (§2.1)
  tiers             LandingPageTier[] — this campaign's own bulk ladder,
                               {minQty, unitPrice}. ABSOLUTE per-unit prices,
                               charged at checkout. Empty = price like the shop
  galleryItems      Json     — [{url, kind:"image"|"video", alt}] — the
                               "what's in the box" slider. Ordered. `kind` is
                               set server-side from the sniffed bytes
  qcImages          String[] — the quality block's photos, ordered. One renders
                               on its own; two or more become a slider
  qcImage           String   — superseded by qcImages, backfilled and blanked
  videoUrl          String   — superseded by galleryItems, ditto
  imageHint         String   — placeholder label (no real image pipeline yet)
  gtmId             String   — this page's own GTM-XXXXXXX container id
  published         Boolean  — false = 404 on the public route
  viewCount         Int      — server-incremented on each public GET
  orderCount        Int      — see §4, attribution is still an open question
  createdAt         DateTime
  updatedAt         DateTime
```

### 2.1 Fields kept but no longer rendered

Four sections came off the page in the 2026-08-20 restructure — the two
coloured price bands, the payment/brand strip, and the numbered feature cards.
The price now sits directly under the hero media instead: `compareAtPrice`
struck through on the left, and on the right the **bundle total the cart will
actually charge**, not `offerPrice`. Taking the live number from the same place
checkout does is what stops the two disagreeing.

These columns keep their data and still round-trip on every save, but nothing
renders them and the admin editor no longer offers a control:

`ribbonText` · `priceCompareLabel` · `priceOfferLabel` · `brandStripTitle` ·
`brandLogos` · `featuresTitle` · `features` · `benefitBullets`

Restoring any of them is a `<Group>` in `components/admin/section-landing-pages.tsx`
plus a block in the page — no migration, no lost Bengali copy. `offerPrice`
also stops rendering but stays in use by `CampaignTracking` and by the admin's
"checkout will charge X" warning.

### 2.2 CTA tracking

Every order button anchors to `#order` and carries a `data-cta`, read by one
delegated listener in `components/marketing/campaign-tracking.tsx`. The full
inventory after the restructure:

`header` · `hero` · `gallery` · `quality` · `countdown` · `order_form`

**`price_band` is gone** — it died with the offer-price band. Any GTM trigger
or report keyed on it stops firing, and `gallery` / `quality` are new values
that need adding to the container.

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

### 3.0 Media endpoints

Files never ride in the form's PATCH — they are multipart, the server stores
them and hands back a URL, so each has its own request (the button IS the
save). Order and alt text are ordinary PATCH fields.

- `POST   /admin/api/landing-pages/:id/gallery` — append one slide, photo or
  clip. `kind` comes from `uploadMedia`'s magic-byte sniffing, never from the
  client. Capped at `MAX_CAMPAIGN_GALLERY`.
- `DELETE /admin/api/landing-pages/:id/gallery/:index` — later slides shift down
- `POST   /admin/api/landing-pages/:id/qc-images` — append one quality photo
- `DELETE /admin/api/landing-pages/:id/qc-images/:index`

`POST …/:id/image` (the old single quality picture) is **gone**.

Deleting a campaign releases its files through `campaignMediaToRelease`, which
subtracts every URL another campaign still points at. `duplicate` copies media
URLs rather than re-uploading them, so two rows can legitimately share a file —
without the check, deleting either one broke the other's pictures.

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
