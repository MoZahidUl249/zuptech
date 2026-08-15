-- Deposit as a percentage, plus curated product rows.
--
-- Three changes, one migration, because the storefront ships them together.
--
--
-- 1. "Product"."minDeposit" (BDT) -> "minDepositPct" (0-100)
--
-- THIS CONVERSION IS LOSSY AND CANNOT BE UNDONE FROM THE MIGRATED DATA. 4250 on
-- a 21250 product becomes 20, and 20% of a later price is a different number of
-- taka. Take a backup before running this against a database with real rows;
-- the down direction below restores a percentage-derived amount, not what was
-- there originally.
--
-- Safe to do as a plain column rewrite because the field is display-only:
-- nothing in pricing, order creation or checkout reads it. The `salePrice`
-- comment in schema.prisma records why percentages were removed from the money
-- path, and that reasoning still stands for anything that IS charged.
--
-- NULLIF guards a zero-priced product, which would otherwise divide by zero;
-- those resolve to 0, which is the right answer for "no deposit required".
-- LEAST clamps the pathological case where a deposit exceeds the price.
-- The conversion is wrapped in a DO block that checks the old column still
-- exists. Prisma's _prisma_migrations table already stops this from running
-- twice, but a re-run against a half-applied database (interrupted between
-- statements) would otherwise die on `column "minDeposit" does not exist` —
-- confirmed by running this file twice against a scratch Postgres. The
-- IF NOT EXISTS clauses promise a re-runnable migration; this is what actually
-- makes it one.
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "minDepositPct" INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Product' AND column_name = 'minDeposit'
  ) THEN
    UPDATE "Product"
    SET "minDepositPct" = LEAST(
          100,
          GREATEST(0, ROUND("minDeposit" * 100.0 / NULLIF("price", 0))::int)
        )
    WHERE "minDeposit" > 0;

    ALTER TABLE "Product" DROP COLUMN "minDeposit";
  END IF;
END
$$;

--
-- 2. Per-product recommendations.
--
-- Ordered id array, not a join table — see the field comment in schema.prisma.
-- Existing rows default to empty, which hides the row on the product page:
-- there is no sensible automatic value here, since the point of the change is
-- that the picks are curated rather than derived.
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "recommendedIds" TEXT[] NOT NULL DEFAULT '{}';

--
-- 3. The home page's second product row.
--
-- Same shape as "featuredIds" beside it. Empty hides the row, so the home page
-- is unchanged by this migration until someone fills the list in.
ALTER TABLE "SiteConfig"
  ADD COLUMN IF NOT EXISTS "homeRowIds" TEXT[] NOT NULL DEFAULT '{}';
