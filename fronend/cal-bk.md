# cal-bk — Money Calculations Moved Out of the Frontend

> **STATUS UPDATE 2026-07-17:** the real backend is live on `localhost:3000`
> and implements this contract (see its OpenAPI doc at
> `http://localhost:3000/openapi`, snapshot in `openapi.json`). Per §5-D the
> frontend's temporary reference routes (`app/api/…`) have been **deleted**;
> the frontend now runs on port **3001** and proxies `/api/*` + `/admin/api/*`
> to the backend (next.config.ts rewrites). §5-A (setup fee) and §5-B (down
> payment) remain open. §5-C is done — the storefront reads the catalog from
> `GET /api/products`; the bundled seed remains only as a display fallback
> when the backend is unreachable.
>
> **STATUS UPDATE 2026-07-18:** the backend replaced the flat district
> whitelist (`area: "Dhaka" | "Chattogram" | …`) with a full location tree —
> `LocationNode` (Division → District → (CityCorporation → CityCorpArea) |
> (Upazila → Union), ~5,000 rows) exposed read-only at `GET /api/locations`
> (`?parentId=` walks down; root when omitted; a customer/order must point
> at a **leaf** — `isLeaf: true`). `quoteDto`/`createOrderDto`/
> `updateProfileDto` all take **`areaId`** (a leaf `LocationNode.id`) instead
> of `area` (district string); `Customer.area` is now `Customer.areaId`. The
> delivery/installation fee for a leaf is the **sum of every node's own
> cost from Division down to it** (`resolveLocationPricing` in
> `src/lib/location.ts`) — admin-editable per node at
> `GET/POST/PATCH/DELETE /admin/api/locations[/:id]`, not a per-district flat
> fee anymore. §2.1–§2.3 and the bypass table below are updated to match;
> `lib/bd-geo.ts` in the frontend repo is kept only as the (Wikipedia/
> DMP-verified) seed data this tree was populated from, not a runtime
> dependency.

**For the backend team.** As of 2026-07-17, the browser code of this app computes
**zero** money. Every amount the customer sees (line total, subtotal, delivery
fee, order total) is fetched from a server endpoint, and order creation ignores
any amount a client might send. This file lists (1) exactly what was removed,
(2) the two routes the backend MUST serve with this exact contract, and (3) the
bypass attacks each server-side rule exists to stop.

Companion spec: `BACKEND.md` (full API surface). This file covers only pricing.

---

## 1. Calculations removed from the frontend (client/browser code)

| # | Was in | Calculation removed | Now lives in |
|---|---|---|---|
| 1 | `lib/cart.tsx` (CartProvider) | `subtotal = Σ product.price × qty` exposed to the whole app via `useCart()` | `POST /api/pricing/quote` → `subtotal` |
| 2 | `components/cart-view.tsx` | per-line `product.price × qty`; `delivery = 150` (hardcoded); `total = subtotal + delivery` | quote `lines[].lineTotal`; delivery/total no longer shown on the cart page — "Calculated at checkout" |
| 3 | `components/checkout-flow.tsx` | `delivery = area === "Dhaka" ? 150 : 350`; `total = subtotal + delivery`; **client-computed `total` written into the saved order**; client-generated order id `ZT-#####`; order summary string | `POST /api/pricing/quote` (display) and `POST /api/orders` (authoritative — id, totals, summary all server-generated) |
| 4 | `components/product-actions.tsx` | `total = product.price × qty + (withSetup ? SETUP_FEE : 0)` on the Add-to-Cart button | Removed. Button shows the catalog unit price only ("… each"); real totals appear in cart/checkout from the server |
| 5 | `lib/products.ts` | `SETUP_FEE = 500` pricing constant | Deleted from the client. **Backend must own the setup fee** — see §5 note A |

What deliberately **stays** in the browser (display-only, not calculation):

- Rendering `product.price` from the catalog (product cards, product page,
  JSON-LD). It is informational; nothing derived from it is ever sent back.
- `formatBDT()` in `lib/site.ts` — string formatting of a server-provided number.
- Cart item **count** badge (Σ qty) — a quantity, not money.
- Admin panel demo aggregations (stock value `Σ cost × stock`, PO value
  `cost × qty`, AOV/growth % in `components/admin/section-{dashboard,analytics,products}.tsx`).
  These run on **hardcoded seed data only** and are already scheduled to be
  replaced by `GET /admin/api/metrics` and the inventory endpoints
  (`BACKEND.md` §3, §5). The backend must compute these; never accept them
  from the admin client.

---

## 2. Routes the backend MUST serve (exact contract)

The frontend already calls these paths. Reference implementations (working
demo, same contract) are in this repo — **replace them, keep the shapes**:

- `app/api/_lib/pricing.ts` — validation + pricing rules
- `app/api/pricing/quote/route.ts`
- `app/api/orders/route.ts`

### 2.1 `POST /api/pricing/quote` — price a cart (display only)

Request:
```json
{
  "items": [{ "productId": "ips1000", "qty": 2 }],
  "areaId": "cmrq6r1x403xrzjtqzm58a1a6"   // a leaf LocationNode id; optional — omitted on the cart page
}
```

Response `200`:
```json
{
  "lines": [{ "productId": "ips1000", "qty": 2, "unitPrice": 42500, "lineTotal": 85000 }],
  "subtotal": 85000,
  "deliveryFee": 350,     // null when no areaId was sent
  "total": 85350          // null when no areaId was sent
}
```

Response `400`: `{ "error": "<reason>" }` for any invalid input (see §3).

### 2.2 `POST /api/orders` — create order (authoritative)

Request — note there is **no price, subtotal, total, or fee field**; if a
client sends one anyway, **ignore it**:
```json
{
  "name": "Karim Uddin",
  "phone": "01712345678",
  "address": "House 12, Road 7",
  "areaId": "cmrpyabvb00008ntq9lzi4rmr",
  "pay": "Cash on Delivery",
  "items": [{ "productId": "ips1000", "qty": 1 }]
}
```
`address` is free text only — the server appends the resolved
Division/…/leaf path itself (`Order.address` ends up e.g. `"House 12, Road
7, Gulshan Thana, Dhaka North City Corporation, Dhaka, Dhaka"`); sending it
again client-side would duplicate it.

Response `200` (everything below is server-computed):
```json
{
  "orderId": "ZT-10242",
  "status": "Processing",
  "items": [{ "productId": "ips1000", "qty": 1, "unitPrice": 42500, "lineTotal": 42500 }],
  "subtotal": 42500,
  "deliveryFee": 150,
  "total": 42650,
  "summary": "1000VA IPS + Battery Combo ×1",
  "pay": "Cash on Delivery",
  "phone": "01712345678",
  "address": "House 12, Road 7, Dhanmondi, Dhaka",
  "createdAt": 1784249479063
}
```

The real backend must additionally: persist the order, issue **sequential**
ids, reserve/decrement stock, auto-create the customer by phone
(`BACKEND.md` §3), and use `unitPrice` captured at order time.

### 2.3 Pricing rules (server-side source of truth)

- Unit price: from the product catalog **by `productId`** — never from the client.
- `subtotal = Σ unitPrice × qty` over validated lines.
- Delivery fee / installation charge: the **sum of every node's own cost**
  on the root→leaf path for `areaId` (`resolveLocationPricing`); `areaId`
  must resolve to a leaf `LocationNode` (`isLeaf: true`) — an intermediate
  node (e.g. a District id) or an unknown id → reject `400`.
- `total = subtotal + deliveryFee`. All amounts integer BDT.

---

## 3. Bypass attacks these routes must block (why each rule exists)

Every rule below is implemented in the reference routes and was tamper-tested.
The backend must keep all of them — **any** amount or rule evaluated in the
browser can be forged with nothing more than DevTools or `curl`.

| Attack | Vector | Server defense |
|---|---|---|
| **Price tampering** | Client sends `unitPrice`/`total` in the order body (old frontend saved a client-computed `total`) | Order/quote bodies accept **only** `productId` + `qty`; prices are re-read from the catalog; extra fields ignored (verified: sending `"total": 1` still produced total 47450) |
| **Negative/fractional qty** | `qty: -5` or `0.5` to shrink the total or corrupt stock math | `qty` must be an integer, `1 ≤ qty ≤ 99`; else `400` |
| **Quantity overflow** | Huge qty / thousands of lines to overflow totals or DoS | Line cap 50, qty cap 99; real backend should also validate against available stock |
| **Delivery-fee tampering** | Claiming a cheap `areaId` (e.g. a village leaf) while shipping to an expensive one, or sending a made-up/non-leaf id | `areaId` must resolve to a real leaf `LocationNode`; fee is always recomputed by summing that leaf's actual root-to-leaf path server-side, never accepted from the client. Ops confirms address vs area by phone before dispatch |
| **Ghost/hidden product** | Ordering a `productId` that is unlisted, hidden (`visible: false`), or fabricated | Unknown id → `400`. Real backend must also reject non-`visible` products |
| **Stale-price replay** | Add to cart, wait for a price increase, order at the old price shown | Order total computed at **order time**, never from a client-cached quote |
| **Setup-fee dodge** | Old UI added `SETUP_FEE` on the product page but the fee never reached the order (pre-existing gap) | Constant removed from client; see §5 note A |
| **Forged order id / summary** | Client used to generate `ZT-#####` and the summary string | Both server-generated; ids must be sequential and unguessable-enough or access-controlled (`GET /api/my/orders` scoped to the authenticated phone) |
| **Direct API abuse** | Skipping the UI entirely and POSTing to the routes | All validation lives in the route, not the form: name ≥ 2 chars, phone `^01\d{9}$` (after stripping spaces/dashes), address > 3 chars, `pay` non-empty ≤ 40 chars, valid JSON. Add rate limiting server-side |

Also re-flagging from `BACKEND.md` §6 (unchanged, still required): recompute
**all** money server-side; RBAC on every admin endpoint; gateway secrets never
in client payloads; admin metrics/stock values computed by the backend.

---

## 4. How the frontend behaves now (so you can match it)

- Cart page: line totals + subtotal from `POST /api/pricing/quote` (no `area`);
  shows "Calculated at checkout" for delivery. If the quote endpoint is down it
  shows `qty × unit price` per line, "—" for subtotal, and a notice.
- Checkout step 3: quote re-fetched with the chosen `area`; the Place-order
  button is **disabled until a server quote exists** and while submitting.
- Place order: `POST /api/orders`; the confirmation screen and the locally
  stored order history use only the server response (`orderId`, `total`,
  `summary`, `address`, `createdAt`). On failure the user sees a retry error —
  no client-side fallback math exists.

## 5. Open items for the backend

- **A. Setup fee (৳500 seed value):** the old UI displayed it but never charged
  it — `withSetup` was never added to the cart or order. Decide the product
  scope, add `withSetup` per order line, and price it **server-side** inside
  the quote/order routes. The product page currently says "fee confirmed by
  phone" as the honest interim copy.
- **B. Down payment:** `minDp` is display-only today. If deposits are taken at
  checkout: `deposit = ceil(price × minDp / 100)` — compute server-side only.
- **C. Catalog prices in the JS bundle:** `lib/products.ts` still ships display
  prices to the browser. Once `GET /api/products` exists, the frontend should
  read the catalog from it so displayed and charged prices can never diverge.
- **D. Delete the reference routes** (`app/api/pricing/`, `app/api/orders/`,
  `app/api/_lib/`) when the real endpoints go live, or turn them into thin
  proxies — do not leave two pricing engines running.
