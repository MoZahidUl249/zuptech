-- Per-page hero slides.
--
-- /services and /industrial rendered the homepage carousel verbatim, so all
-- three pages showed identical art. A slide now carries the set of pages it
-- appears on, which lets each page have its own banners while still allowing
-- one banner to serve several pages without uploading the art twice.
--
-- Existing rows default to '{home}': that is exactly where they rendered
-- before, so the homepage is unchanged by this migration and the other two
-- pages fall back to the built-in art until slides are assigned to them.
ALTER TABLE "HeroSlide"
  ADD COLUMN IF NOT EXISTS "pages" TEXT[] NOT NULL DEFAULT '{home}';
