-- Admin-typed sale percentage, a manual stock-tag override, and the index the
-- tag derivation needs.
--
-- Re-runnable: every statement is guarded, and the backfill only runs while
-- the column it reads still looks un-backfilled. Same discipline as
-- 20260813120000, which was not re-runnable until it was fixed.

--
-- 1. "Product"."salePct" — the discount the admin types.
--
-- Backfilled from the sale prices already stored, so nothing on the storefront
-- changes appearance on deploy: a product at 42500 with a 38250 sale price
-- reads as 10% afterwards, and salePriceFrom(42500, 10) returns 38250 again.
--
-- The reverse direction is the lossy one. Rounding to a whole percent means a
-- price that was not a clean percentage off cannot be reproduced exactly — a
-- 999 product with a 669 sale price backfills to 33%, and 33% of 999 is 669.33
-- -> 669, which happens to round-trip, but that is luck rather than a
-- guarantee. `salePrice` is NOT recomputed here for exactly that reason: what
-- customers currently see is preserved, and the percentage only becomes
-- authoritative from the next admin save onward.
--
-- NULLIF guards a zero-priced row. The BETWEEN bounds skip rows where the sale
-- price is nonsense (0, or >= price) — those are not sales and read as 0%.
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "salePct" INTEGER NOT NULL DEFAULT 0;

UPDATE "Product"
SET "salePct" = LEAST(100, GREATEST(0,
      ROUND(("price" - "salePrice") * 100.0 / NULLIF("price", 0))::int))
WHERE "salePct" = 0
  AND "onSale" = true
  AND "salePrice" > 0
  AND "salePrice" < "price";

--
-- 2. "Product"."stockTag" — manual override, "" means derive it.
--
-- No backfill: an empty string is "derive from stock", which reproduces
-- today's behaviour exactly (the card showed "Out of stock" off availability
-- and nothing else).
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "stockTag" TEXT NOT NULL DEFAULT '';

--
-- 3. The index behind the "Incoming" tag.
--
-- GET /api/products asks, for every product on the page, whether an in-transit
-- purchase order exists. Without this that is a scan of PurchaseOrder per
-- product on the site's busiest dynamic route. CONCURRENTLY is deliberately
-- NOT used: Prisma runs migrations inside a transaction, which forbids it, and
-- this table is small enough that the brief lock is not worth splitting the
-- migration to avoid.
CREATE INDEX IF NOT EXISTS "PurchaseOrder_productId_status_idx"
  ON "PurchaseOrder" ("productId", "status");
