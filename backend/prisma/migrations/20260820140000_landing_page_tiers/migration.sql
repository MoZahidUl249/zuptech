-- A campaign's own bulk price ladder.
--
-- Until now the only bulk tiers were Product.quantityOffers, which also drive
-- the public product page and ordinary checkout — so pricing a campaign meant
-- repricing the whole shop. This table lets one campaign carry its own ladder
-- and leaves the storefront untouched.
--
-- `unitPrice` is an ABSOLUTE price per unit, not taka off. The product ladder
-- stores a discount off the LIST price and then caps it at the sale price,
-- which makes a shallow tier silently worthless: a ৳200 tier on a product
-- listed at ৳2,600 and on sale at ৳2,184 resolved to ৳2,184 and saved nothing,
-- while the page advertised "Save ৳200 per unit". An absolute price cannot be
-- swallowed that way.
--
-- PURELY ADDITIVE. One new empty table, no ALTER on any existing table, no
-- backfill. "No tiers" is defined as today's behaviour, so applying this
-- changes exactly zero prices and old code cannot see the table at all.
--
-- Re-runnable by hand, like the rest: the CLI won't apply it twice, but this
-- file is also what gets pasted into psql when a deploy half-applies.
CREATE TABLE IF NOT EXISTS "LandingPageTier" (
  "id"            SERIAL NOT NULL,
  "landingPageId" TEXT   NOT NULL,
  "minQty"        INTEGER NOT NULL,
  "unitPrice"     INTEGER NOT NULL,

  CONSTRAINT "LandingPageTier_pkey" PRIMARY KEY ("id")
);

-- One row per quantity threshold per campaign; the write path replaces the
-- whole ladder, so a duplicate here is a bug rather than a merge.
CREATE UNIQUE INDEX IF NOT EXISTS "LandingPageTier_landingPageId_minQty_key"
  ON "LandingPageTier" ("landingPageId", "minQty");

CREATE INDEX IF NOT EXISTS "LandingPageTier_landingPageId_idx"
  ON "LandingPageTier" ("landingPageId");

-- Cascade: a deleted campaign takes its prices with it. Guarded so the file
-- stays re-runnable — ADD CONSTRAINT has no IF NOT EXISTS.
DO $$
BEGIN
  ALTER TABLE "LandingPageTier"
    ADD CONSTRAINT "LandingPageTier_landingPageId_fkey"
    FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
