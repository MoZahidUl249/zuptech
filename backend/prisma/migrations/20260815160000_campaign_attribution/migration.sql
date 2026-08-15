-- Per-campaign sales attribution, and two small integrity fixes.
--
-- Written re-runnable throughout: _prisma_migrations stops the CLI applying
-- this twice, but this file is also what an operator pastes into psql when a
-- deploy half-applied, and that is exactly when it must not compound the mess.

-- 1. Which campaign produced an order.
--
-- Nullable: most orders are ordinary storefront checkouts, and an order must
-- never fail for want of an attribution. ON DELETE SET NULL because deleting a
-- finished campaign must not delete the revenue it earned — the order stays,
-- it simply stops being attributed.
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "landingPageId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Order_landingPageId_fkey'
  ) THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT "Order_landingPageId_fkey"
      FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- The admin campaign list groups every order by campaign on each load.
CREATE INDEX IF NOT EXISTS "Order_landingPageId_idx" ON "Order"("landingPageId");

-- 2. Drop the counter that never counted.
--
-- `LandingPage.orderCount` was written by nothing in the codebase, so every
-- campaign reported "0 orders" forever — read by operators as "no sales", not
-- as "never measured". Orders are now counted from the rows above, which
-- cannot drift from the orders they count. Dropping it rather than leaving a
-- column that lies.
ALTER TABLE "LandingPage"
  DROP COLUMN IF EXISTS "orderCount";

-- 3. A payment method's name is how checkout finds it, so make it unique.
--
-- Two rows sharing a name made the lookup pick an arbitrary winner, and which
-- one it picked decided whether the order was accepted at all. Existing
-- duplicates are renamed rather than deleted — a payment method is referenced
-- by historical orders through its stored name, and the operator needs to see
-- what happened and fix it deliberately.
UPDATE "PaymentMethod" p
   SET name = p.name || ' (' || p.id || ')'
 WHERE EXISTS (
   SELECT 1 FROM "PaymentMethod" q
    WHERE q.name = p.name AND q.id < p.id
 );

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentMethod_name_key" ON "PaymentMethod"("name");
