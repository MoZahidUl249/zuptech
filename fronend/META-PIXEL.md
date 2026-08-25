# Meta Pixel — what the site sends, and what the containers still get wrong

Read this before touching `lib/analytics.ts`, `lib/customer-match.ts`, or either
GTM container. It records what was actually measured on 2026-08-25, not what the
setup was assumed to do.

## ⚠️ Before any of the below matters: the containers do not load

Measured on live, 2026-08-25, in a real browser on both funnels:

```
/checkout           gtm.js requested: 0   fbq: undefined   fbevents.js: 0
/lp/diy-toolset-38  gtm.js requested: 0   fbq: undefined   facebook.com/tr pings: 0
```

**No GTM container loads on the live site**, so nothing reaches Meta or GA4 from
either funnel, and none of the tag wiring described below has ever run.

This is not an ad blocker and not the network. Injecting the same script by hand
from the page console loads it fine (`probeResult: "LOADED"`), so the browser and
CSP allow it — **the page simply never asks**. On `/checkout` the
`<script id="gtm-loader">` element is present in the DOM while `gtm.js` was never
requested, which points at the inline content not executing rather than the
component failing to render. `grep 'gtm.start'` against the server HTML returns
0 on the campaign page too: the id appears only inside the RSC payload as a
serialized prop.

Both loaders use `next/script` with `strategy="afterInteractive"` and
`dangerouslySetInnerHTML` — `components/gtm.tsx` and
`components/marketing/landing-page-gtm.tsx`. That pattern is what the Next docs
prescribe for inline scripts (an `id` is required and both have one), so this
needs its own investigation against this version of Next before anything else
here is worth doing.

**Fix this first.** Everything below is downstream of it.

## The split

Analytics here has two halves that fail independently:

- **This repo** pushes to `dataLayer`. It is correct and complete.
- **The GTM containers** decide what reaches Meta. Two faults live there and
  cannot be fixed from this codebase.

Both containers' published config is public — `https://www.googletagmanager.com/gtm.js?id=<ID>` —
so their real wiring can be read without an account. That is how everything below
was established.

| | Container | Meta pixel |
|---|---|---|
| Storefront | `GTM-MW9FB35T` | `999366915990718` |
| Campaign `/lp/*` | `GTM-5PJLSZKR` | `1956396714935002` |

Each landing page carries its **own** `gtmId` column, so a second campaign can
have a third container. Never assume "the" container: any tag change must be
made in every one, or the storefront and the ads disagree.

## What the site sends on purchase

`trackPurchase()` emits two pushes, in this order:

1. **`customer_data`** — Meta's Advanced Matching fields, SHA-256 hashed, under
   the variable names both containers already read (`customerFirstName`,
   `customerLastName`, `customerBillingPhone`, `customerBillingEmail`,
   `customerBillingCity`, `customerBillingCountry`).
2. **`purchase`** — GA4 `ecommerce` plus a `meta` block carrying `content_ids`
   as a proper **array**, `contents` with per-item quantity and price,
   `num_items`, `value`, `currency`, `order_id`.

The order is not cosmetic. A GTM variable resolves when its tag fires, so
matching data arriving in the same push as `purchase` is a race, and data
arriving after it is too late.

**Values are hashed here, not in the tag.** `dataLayer` is readable by every tag
in the container, and the CSP in `next.config.ts` shows these containers cleared
for TikTok, Microsoft Clarity and Hotjar — two of which record sessions. Raw
phone numbers there would be handed to all of them. Meta hashes and compares
digests anyway, so match quality is identical; this only decides who *else* sees
the plaintext. `customer-match.test.ts` fails if any raw value ever survives.

Consequence: **the tag must treat these fields as already hashed.** One left on
"hash this for me" would hash the digest and match nothing.

## What is still broken, in both containers

### 1. `content_ids` is a comma-joined string

Macro **12** in both containers is a Custom JavaScript variable:

```js
(function(){ var a = {{ecommerce.items}}; return a.map(function(b){ return b.item_id }).join() })();
```

`.join()` produces `"ips1000,solar500"`. Meta requires an array. A single-item
order survives it; a multi-item storefront order becomes one id matching no
product, so dynamic-ads retargeting has nothing to work with.

**Fix:** point the field at `{{meta.content_ids}}` — the site already emits the
array, so the custom JS can be deleted rather than repaired. Macro 11 has the
same bug for `content_name`.

Tags affected — **ViewContent, AddToCart, InitiateCheckout, PageView, Purchase**
in each container, not just Purchase.

### 2. `contents` and `num_items` are never read

Grep either container for `meta.contents` or `meta.num_items`: zero hits. The
site emits both; nothing consumes them, so Meta gets no per-item quantity or
price. **Fix:** add two Data Layer Variables and map them onto the Meta tags.

## What is already right — do not "fix" it

The Purchase tag in each container **already maps all eight Advanced Matching
fields** (`em`, `ph`, `fn`, `ln`, `ct`, `st`, `zp`, `country`) to the
`customer*` variables. That wiring has always been there; it was starved because
the site pushed nothing into it until 2026-08-25. Do not rebuild it.

## Fields we deliberately do not send

- **`zp` / postcode, `st` / state** — checkout collects a free-text address and a
  delivery zone, neither of which yields a reliable value. A guessed postcode
  lowers match quality rather than raising it.
- **`ct` / city** — claimed only when the zone says inside Dhaka. "Outside
  Dhaka" names no city.
- **`em`** — signed-in customers only. `Customer.email` is nullable and most
  orders are guest checkout.
- **`customerBillingAddress1`, `customerTotalOrderValue`, `customerTotalOrders`** —
  declared in the containers but unused by Meta's Advanced Matching. Not worth
  pushing personal data that nothing consumes.

An absent field is omitted, never sent blank: an empty string is a value Meta
tries to match on and fails.

## Verifying a change

1. GTM **Preview** against the local stack — confirm the tag fires and every
   field resolves before publishing.
2. **Meta Events Manager → Test Events** — place one order per funnel and check
   `content_ids` arrives as an array, `contents` carries quantities, and
   Advanced Matching reports as matched. This is the only place that confirms
   the hashed-vs-raw question end to end.
3. Publish each container as a named version so it rolls back in one click.
