-- Campaign page content for /lp/:slug.
--
-- Every visitor-facing string on a landing page becomes an admin-editable
-- column, so a campaign can be written end to end from the panel — including
-- entirely in Bangla. None of this is money: prices still come from the
-- product, and the bundle ladder renders from Product.quantityOffers, so an
-- advertised bundle total is by construction the total priceCart() charges.
--
-- All columns are defaulted, so every existing landing page keeps working and
-- simply renders the new sections empty until someone fills them in.
ALTER TABLE "LandingPage"
  ADD COLUMN IF NOT EXISTS "hotlineLabel"       TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "hotlineNumber"      TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "headerCtaLabel"     TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "trustBadges"        TEXT[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "subheadline"        TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "discountBadge"      TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "heroCtaNote"        TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "brandStripTitle"    TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "brandLogos"         TEXT[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "videoTitle"         TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "videoUrl"           TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "featuresTitle"      TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "features"           JSONB     NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "specTitle"          TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "specMeta"           TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "specs"              JSONB     NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "bundlesTitle"       TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "bundlesSubtitle"    TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "bundleUnitLabel"    TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "bundleMaxQty"       INTEGER   NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "qcTitle"            TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "qcBody"             TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "qcPoints"           TEXT[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "qcImageHint"        TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "countdownTitle"     TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "countdownNote"      TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "countdownEndsAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "countdownCtaLabel"  TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "countdownAssurance" TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "testimonialsTitle"  TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "testimonials"       JSONB     NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "formTitle"          TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "formIntro"          TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "formLabels"         JSONB     NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "footerTagline"      TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "footerAbout"        TEXT      NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "footerLines"        TEXT[]    NOT NULL DEFAULT '{}';
