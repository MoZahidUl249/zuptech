-- Per-campaign colours and a product row for landing pages.
--
-- Every colour the /lp/:slug template paints with becomes a column, so two
-- campaigns can run at once without sharing a palette. Named by ROLE, not by
-- hue, so recolouring a page does not turn every column name into a lie.
--
-- Defaults are the reference design's palette. That means existing pages take
-- on the new look on deploy — which is the intent: this ships alongside the
-- template replacement, and a page half in the old style and half in the new
-- would be worse than either. Verified beforehand that the only published
-- landing page on live is a test with 2 views and 0 orders, so no real
-- campaign changes appearance under anyone's feet.
--
-- Re-runnable, like the two migrations before it.
ALTER TABLE "LandingPage"
  ADD COLUMN IF NOT EXISTS "colorHeroBg"    TEXT NOT NULL DEFAULT '#17341B',
  ADD COLUMN IF NOT EXISTS "colorHeroText"  TEXT NOT NULL DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS "colorBandBg"    TEXT NOT NULL DEFAULT '#45712F',
  ADD COLUMN IF NOT EXISTS "colorBandText"  TEXT NOT NULL DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS "colorTintBg"    TEXT NOT NULL DEFAULT '#F2F5EC',
  ADD COLUMN IF NOT EXISTS "colorPageBg"    TEXT NOT NULL DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS "colorPageText"  TEXT NOT NULL DEFAULT '#15181E',
  ADD COLUMN IF NOT EXISTS "colorAccent"    TEXT NOT NULL DEFAULT '#45712F',
  ADD COLUMN IF NOT EXISTS "colorHighlight" TEXT NOT NULL DEFAULT '#FFF306',
  ADD COLUMN IF NOT EXISTS "colorCtaBg"     TEXT NOT NULL DEFAULT '#000000',
  ADD COLUMN IF NOT EXISTS "colorCtaText"   TEXT NOT NULL DEFAULT '#FFFFFF';

-- The product row above the page body. Empty hides it, so nothing appears on
-- an existing page until someone picks products for it.
ALTER TABLE "LandingPage"
  ADD COLUMN IF NOT EXISTS "productRowIds" TEXT[] NOT NULL DEFAULT '{}';

-- The two price-band labels. Own columns, not formLabels entries: that object
-- is the order form's vocabulary and these belong to the hero bands. Blank
-- falls back to English in the renderer.
ALTER TABLE "LandingPage"
  ADD COLUMN IF NOT EXISTS "priceCompareLabel" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "priceOfferLabel"   TEXT NOT NULL DEFAULT '';
