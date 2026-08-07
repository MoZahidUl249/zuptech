-- Site content cleanup.
--
-- Three groups of drops, all of them things no visitor could ever see:
--
--   1. Copy columns whose sections were deleted from the pages. Every one was
--      still editable in the admin, so staff could type into fields that
--      rendered nowhere. If a section comes back, its column comes back with
--      it.
--   2. PageHero / HeroPoster — the per-page hero art feature. No storefront
--      page rendered it; the whole cluster (7 admin routes, a public route, an
--      editor) was write-only.
--   3. Cart — server-side cart sync. Never called: the storefront cart is
--      localStorage only.
--
-- And the additions: the office/warehouse/opening-hours block that the contact
-- page had hardcoded in the frontend with placeholder values, plus the
-- services page headline, so all three top-level pages take their <h1> from
-- the same place.

-- AlterTable — add the contact-page block and the services headline
ALTER TABLE "SiteConfig" ADD COLUMN     "servicesHeroHeadline" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SiteConfig" ADD COLUMN     "officeName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SiteConfig" ADD COLUMN     "warehouseName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SiteConfig" ADD COLUMN     "warehouseAddress" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SiteConfig" ADD COLUMN     "hoursWeekday" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SiteConfig" ADD COLUMN     "hoursWeekend" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SiteConfig" ADD COLUMN     "hoursEmergency" TEXT NOT NULL DEFAULT '';

-- AlterTable — drop the 21 copy columns nothing renders
ALTER TABLE "SiteConfig"
  DROP COLUMN "featuredHeading",
  DROP COLUMN "servicesHeading",
  DROP COLUMN "servicesSubtitle",
  DROP COLUMN "homeHeroEyebrow",
  DROP COLUMN "homeHeroSubhead",
  DROP COLUMN "homeIndustrialEyebrow",
  DROP COLUMN "homeIndustrialHeading",
  DROP COLUMN "homeCapabilitiesEyebrow",
  DROP COLUMN "homeCapabilitiesHeading",
  DROP COLUMN "homeCtaHeading",
  DROP COLUMN "homeCtaSubtext",
  DROP COLUMN "homeCtaButton",
  DROP COLUMN "industrialHeroEyebrow",
  DROP COLUMN "industrialHeroSubhead",
  DROP COLUMN "industrialGridHeading",
  DROP COLUMN "industrialGridBody",
  DROP COLUMN "industrialServicesHeading",
  DROP COLUMN "industrialServicesSubtitle",
  DROP COLUMN "industrialStandardsHeading",
  DROP COLUMN "industrialStandardsBody",
  DROP COLUMN "contactTeamHeading";

-- DropTable — child first, then the parent it cascades from
DROP TABLE "HeroPoster";
DROP TABLE "PageHero";

-- DropTable — server-side cart sync, never called
DROP TABLE "Cart";
