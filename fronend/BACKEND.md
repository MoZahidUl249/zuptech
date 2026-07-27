# ZUP TECH — Backend Specification

This document describes everything a backend needs to power the ZUP TECH site
(storefront + `/admin` panel). The frontend is a complete, working Next.js 16
app in this repo; **all data currently lives client-side in `localStorage` as a
demo**. The backend's job is to replace those stores with real APIs without
changing the UI.

- Storefront: `/` `/shop` `/products/[slug]` `/solutions` `/contact` `/cart` `/checkout` `/account`
- Admin panel: `/admin` (noindexed; role-based access)
- Currency: BDT, lakh-style formatting (`৳ 9,18,000`). Phone format: `01XXXXXXXXX` (BD).

---

## 1. Current frontend architecture (what you are replacing)

| Concern | File | Storage key | Notes |
|---|---|---|---|
| Admin state (everything below) | `lib/admin.tsx` | `zup-admin-state-v1` | One JSON blob, React context, seeded demo data |
| Admin session | `lib/admin.tsx` | `zup-admin-session` | Staff id string |
| Customer cart | `lib/cart.tsx` | `zup-cart` | `{ [productId]: qty }` |
| Customer orders | `lib/orders.ts` | `zup-orders` | Array of StoredOrder |
| Customer "auth" | `lib/orders.ts` | `zup-auth-phone` | Phone number = identity (no OTP yet) |
| Admin→storefront bridge | `lib/admin-bridge.ts` | reads `zup-admin-state-v1` | Hooks: `useFeaturedProducts`, `useHeroSlides`, `usePaymentOptions`, `useSiteContact`, `useGtmId` |
| Static catalog | `lib/products.ts` | — | 10 seed products (source of truth for slugs/SEO today) |

**Integration seams** — swap these to API calls and the UI follows:
1. `AdminProvider` in `lib/admin.tsx` (`state`, `update(patch)`, `login`, `logout`)
2. The five bridge hooks in `lib/admin-bridge.ts` (become public read APIs)
3. `saveOrder()` in `lib/orders.ts` (becomes `POST /api/orders`)
4. `lib/products.ts` static array (becomes `GET /api/products`, keep slugs stable)

---

## 2. Data models

Types below mirror `lib/admin.tsx`, `lib/products.ts`, `lib/orders.ts` exactly.

### Product
```ts
{
  id: string;              // e.g. "ips1000"
  slug: string;            // e.g. "1000va-ips-battery-combo" — used in URLs, keep stable
  name: string;
  cat: "Home" | "Industrial";
  tags: string[];
  price: number;           // BDT
  minDp: number;           // minimum down payment, % of price (0–100)
  rating: number;          // aggregate, shown + used in JSON-LD
  sold: number;            // units sold counter
  imgHint: string;         // placeholder label until real images exist
  specs: string[];         // 4 bullet points
  description: string;
  // admin-side extras (AdminProduct):
  sku: string;             // e.g. "ZT-IPS-1000" — server-generated on create (ZT-P0001…), stable afterwards
  cost: number;            // purchase cost (BDT) — drives stock value
  stock: number;           // on hand
  reserved: number;        // allocated to open orders
  reorderAt: number;       // low-stock threshold
  visible: boolean;        // "Live" on store vs "Hidden"
  featured: boolean;       // membership + ORDER matters (home page row)
  photos: string[];        // main + 2 gallery images (move to object storage!)
  video: string             //video url
}
```

### Order
```ts
{
  id: string;              // "ZT-10241" — sequential, server-generated
  customer: string;        // full name
  phone: string;           // 01XXXXXXXXX — also the customer's login identity
  address: string;         // free text + district, e.g. "House 12, Road 7, Dhanmondi, Dhaka"
  items: { productId: string; qty: number; unitPrice: number }[];
  subtotal: number;
  deliveryFee: number;     // 150 inside Dhaka, 350 elsewhere (current rule)
  total: number;
  pay: string;             // chosen payment method name
  status: "Processing" | "Confirmed" | "On the way" | "Delivered" | "Cancelled";
  createdAt: timestamp;
}
```
Storefront currently stores a denormalized `summary` string — replace with real items.

### Customer
```ts
{ id, name, phone (unique — this IS the login), orders: count, joined: date }
```
Accounts auto-create on first purchase (guest checkout). Later login = phone + OTP
(OTP intentionally not implemented yet; frontend signs in with bare phone).

### ServiceLead
```ts
{ id, service: string, customer: string, city: string,
  status: "New"|"Contacted"|"Survey booked"|"Quoted"|"Won"|"Lost" }
```
Created by the home-service booking form on `/services`
(`components/marketing/consultancy-form.tsx`), which posts a real
`Service.id` as `serviceId`.

#### IndustrialLead
```
{ id, service: string, serviceId: string|null, company, contactName,
  designation, phone, email, sector, scope, timeline, siteLocation,
  load, budget, notes,
  status: "New"|"Qualifying"|"Site survey"|"Proposal sent"
         |"Negotiation"|"Won"|"Lost" }
```
Created by the industrial enquiry form on `/industrial`
(`components/marketing/industrial-consultation-form.tsx`). A separate model
from ServiceLead, not a flag on it: B2B enquiries are qualified on company /
sector / connected load / timeline and run the longer pipeline above.
`serviceId` is a best-effort link (null when the submitted id has no
IndustrialService row); `service` is the always-stored label snapshot.

### Staff & RBAC
```ts
Role  { id, name, permissions: Record<Module, "none"|"view"|"manage"> }
Staff { id, name, phone, username (unique), passwordHash, roleId }

Modules: dashboard, analytics, orders, products, inventory, leads,
         customers, homepage, sitecontent, payments, staff
```
- Seed roles: **Super Admin** (all manage, immutable), **Manager**, **Support**.
- Invariants the backend must enforce: super admin role can't be edited/deleted;
  a staff member can't remove themselves; roles with staff can't be deleted;
  usernames unique.
- ⚠️ Frontend hashes passwords with SHA-256 for demo storage. The server must
  use bcrypt/argon2 and issue httpOnly session cookies or JWTs. **All RBAC
  checks must be re-enforced server-side per request** — the client-side gate
  is cosmetic.

### Inventory
```ts
Supplier      { id, name, contact, phone, items }
PurchaseOrder { id ("PO-2211"), supplierId, productId, qty, value, eta,
                status: "Confirmed"|"In transit"|"Received"|"Cancelled" }
StockMovement { id, date, sku, change (+/-), reason, by (staff username) }
```

### Site content (admin-managed, publicly readable)
```ts
HeroSlide    { id, image, cta, href, active, fit?, bg? }   // home banner
featuredIds  string[]                                      // ordered product ids
SiteCopy     { featuredHeading, servicesHeading, servicesSubtitle, footerDescription }
SiteContact  { phone, phoneDisplay, hotline, email, whatsapp (digits),
               street, city, postalCode, hours }
Integrations { gtmId, gtmEnabled }        // GTM id validated: /^GTM-[A-Z0-9]{4,10}$/
PaymentMethod{ id, name, kind ("Mobile wallet"|"Card gateway"|"Offline"),
               provider, providers[], enabled, environment ("Live"|"Test"),
               apiKey, apiSecret, webhookUrl, isGateway }
```
⚠️ `apiSecret` must live **only** on the server (env/secret manager). The admin
UI masks it; today it sits in localStorage — that must end with the backend.

---

## 3. API surface (suggested)

### Public (storefront)
| Method & path | Purpose |
|---|---|
| `GET /api/products` | Visible products (respect `visible`), incl. `minDp` |
| `GET /api/products/:slug` | Product detail |
| `GET /api/site-config` | One payload for the bridge: `{ featuredIds, slides, contact, copy, gtm: { id or null }, paymentOptions: [{label, sub}] }` — **never include gateway keys/secrets** |
| `POST /api/orders` | Create order (guest checkout). Validates phone `^01\d{9}$`, address len > 3, recomputes totals server-side, decrements/reserves stock, auto-creates customer by phone |
| `GET /api/my/orders` | Customer's orders (session by phone/OTP) |
| `POST /api/auth/otp` + `POST /api/auth/verify` | Phone login for order tracking |
| `POST /api/leads` | Home-service booking form submission (`/services`) |
| `POST /api/industrial-leads` | Industrial enquiry submission (`/industrial`) |
| `POST /api/contact` | Contact form message |

### Admin (staff session + per-module RBAC)
| Area | Endpoints |
|---|---|
| Auth | `POST /admin/api/login` (username+password), `POST /admin/api/logout` |
| Dashboard/Analytics | `GET /admin/api/metrics?period=week\|month\|year` — revenue series, orders, new customers, AOV, category split. (Frontend currently uses hardcoded demo series in `components/admin/section-{dashboard,analytics}.tsx` — replace with this endpoint.) |
| Orders | `GET /admin/api/orders?q=&status=`, `PATCH /admin/api/orders/:id {status}` |
| Products | full CRUD + `PATCH .../featured` (order-preserving add/remove), photo upload → object storage (S3-style), 1.5 MB client cap already enforced |
| Inventory | `PATCH /admin/api/stock/:productId {onHand, reason}` (logs movement); `POST /admin/api/purchase-orders` (+ auto "Reorder" uses qty = max(reorderAt*2 − stock, reorderAt)); `POST .../:id/receive` → stock += qty, movement logged, status=Received; `POST .../:id/cancel`; suppliers CRUD (block delete while open POs exist); `GET /admin/api/movements` |
| Leads / Customers | list + `PATCH` lead status |
| Industrial leads | `GET /admin/api/industrial-leads?status=&sector=`, `PATCH .../:id {status}`, `DELETE .../:id` — same `leads` permission, separate screen and pipeline |
| Content | `PUT /admin/api/slides`, `PUT /admin/api/copy`, `PUT /admin/api/contact`, `PUT /admin/api/integrations` |
| Payments | `GET/PUT /admin/api/payment-methods` (secrets write-only; return masked) |
| Staff | staff CRUD + role CRUD + permission matrix (enforce invariants above) |

### Payment gateway callbacks
Seeded webhook URLs (configurable per method in admin):
- `https://api.zuptech.com/pay/bkash` — bKash Merchant API
- `https://api.zuptech.com/pay/nagad` — Nagad PGW
- `https://api.zuptech.com/pay/card` — SSLCommerz (currently Test mode)
- Cash on Delivery: no gateway; Rocket: disabled seed.
Order flow: order is created as `Processing`; wallet/card methods then get a
payment request; webhook confirms → status `Confirmed`.

---

## 4. Business rules (implemented in the UI today — keep behavior identical)

1. **Delivery fee**: ৳150 Dhaka, ৳350 any other district. Districts list:
   Dhaka, Chattogram, Sylhet, Khulna, Rajshahi, Other district.
2. **Phone validation**: `^01\d{9}$` after stripping spaces/dashes.
3. **Available stock** = `stock − reserved` (floor 0). **Low stock** = `0 < stock ≤ reorderAt`; **Out** = `stock === 0`.
4. **Stock value** = Σ `cost × stock` (cost, not price).
5. **Receiving a PO** adds qty to stock **and** writes a StockMovement (`+qty`, "PO-xxxx received", by staff).
6. **Manual stock adjust** writes a movement with the delta and reason "Manual stock adjustment".
7. **Featured products**: ordered list; products deleted from catalog are removed from it; only catalog-linked products can be featured.
8. **Min down payment**: informational on product page today ("Minimum down payment for this product X%."). If checkout later takes deposits, amount = `ceil(price × minDp / 100)`.
9. **Hero slides**: only `active` slides **with an image** render; zero active → storefront falls back to defaults.
10. **GTM**: load only when enabled AND id matches `^GTM-[A-Z0-9]{4,10}$`.
11. **Checkout payment options** = enabled PaymentMethods; if the selected one is disabled mid-session the first remaining option is used.
12. **Order ids**: `ZT-` + number (demo uses random 5 digits; make it sequential).
13. **Account auto-creation**: placing an order signs the customer in by phone (no password). Copy shown: "Sign in anytime with this number to track your order — no password or code needed." — replace with OTP when backend lands.

---

## 5. Analytics the dashboard expects

- KPI cards: orders this week (+% vs last), revenue this week (+%), open service leads (+new today), low-stock count / open POs.
- Revenue last 14 days (daily bars, max highlighted).
- Analytics section: Week/Month/Year period; revenue/orders/new-customers/AOV series with previous-period comparison; category revenue split (Home / Industrial / Services); "detailed analysis" bullets are computed from the series client-side.
- All numbers currently hardcoded demo data — the metrics endpoint replaces them.

---

## 6. Security checklist for the backend

- [ ] Server-side session auth (httpOnly, Secure, SameSite cookies) for staff & customers; bcrypt/argon2 password hashes; rate-limit login + OTP.
- [ ] Enforce the RBAC matrix on **every** admin endpoint (module → none/view/manage).
- [ ] Gateway API keys/secrets in env/secret manager only; masked in API responses; never in the public site-config payload.
- [ ] Validate/normalize all input server-side (phone regex, GTM id regex, address length, qty ≥ 1, price/cost ≥ 0, minDp 0–100); recompute all money server-side — never trust client totals.
- [ ] Product images: object storage + size/type validation (frontend caps at 1.5 MB, images/* only).
- [ ] Keep the headers set in `next.config.ts` (nosniff, DENY framing, referrer & permissions policy); add a CSP with nonces once script inventory is known (GTM requires `https://www.googletagmanager.com`).
- [ ] `/admin` is noindexed and disallowed in robots.txt already; consider IP allowlisting or 2FA for staff.
- [ ] Audit log: StockMovements exist; extend the pattern to order-status changes, payment-config changes, and staff/role edits.

---

## 7. Seed data

Full seed lives in `seedState()` in `lib/admin.tsx` and `products` in
`lib/products.ts`: 10 products (SKUs ZT-…), 6 orders (ZT-10236…10241), 5
customers, 5 service leads, 3 suppliers, 3 purchase orders, 5 stock movements,
3 staff (arif/nusrat/rakib — demo password `zup123`), 3 roles, 5 payment
methods, 2 hero slides, contact info, and copy. Import it as the initial
database seed so the demo keeps working unchanged.

---

## 8. Suggested rollout order

1. **Auth + staff/RBAC** (unblocks everything admin).
2. **Products + images + featured** (storefront reads become API-backed; keep slugs).
3. **Orders + customers** (checkout → real orders; reserve stock).
4. **Inventory** (adjust, POs, receive, suppliers, movements).
5. **Content & integrations** (slides, copy, contact, GTM — moves GTM from per-browser localStorage to global config so every visitor gets tagged).
6. **Payments** (gateway config + webhooks + real payment initiation).
7. **Metrics** endpoint for dashboard/analytics.

Each step maps to one seam in §1 — the UI needs no redesign, only the data
source swapped.
