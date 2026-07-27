-- Catalog taxonomy + Services rework.
--
-- Hand-written rather than generated, because the generated version would
-- drop `Product.cat`/`Product.tags`, drop the `Solution` table and drop
-- `ServiceLead.service` outright. Every step below backfills first, so no
-- existing row is lost:
--
--   Section  <- distinct Product.cat
--   Category <- distinct Product.tags[1] (fallback "<cat> General")
--   Product.categoryId <- the category derived above
--   Service  <- the Solution table, renamed in place
--   ServiceLead.serviceId <- matched on the old free-text `service` string
--
-- Categories are globally unique by name, so a tag that appeared under both
-- "Home" and "Industrial" (e.g. Solar, Protection) is assigned to the section
-- of the lowest-id product using it — deterministic, and re-assignable from
-- the admin panel afterwards.

-- ============================================================
-- 1. Taxonomy tables
-- ============================================================

CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "svgLogo" TEXT NOT NULL DEFAULT '',
    "sectionId" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Section_name_key" ON "Section"("name");
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE INDEX "Category_sectionId_idx" ON "Category"("sectionId");

ALTER TABLE "Category" ADD CONSTRAINT "Category_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 2. Backfill sections from Product.cat
-- ============================================================

INSERT INTO "Section" ("id", "name", "sort")
SELECT gen_random_uuid()::text, s.name, s.sort
FROM (VALUES ('Home', 0), ('Industrial', 1)) AS s(name, sort)
ON CONFLICT ("name") DO NOTHING;

-- Any other value that made it into cat by hand.
INSERT INTO "Section" ("id", "name", "sort")
SELECT gen_random_uuid()::text, p."cat", 2
FROM (SELECT DISTINCT "cat" FROM "Product") AS p
ON CONFLICT ("name") DO NOTHING;

-- ============================================================
-- 3. Backfill categories from Product.tags[1]
-- ============================================================

-- Each product's category name and the section it should land under.
CREATE TEMP TABLE product_category_map AS
SELECT
    p."id"  AS product_id,
    p."cat" AS section_name,
    CASE
        WHEN array_length(p."tags", 1) >= 1 AND btrim(p."tags"[1]) <> ''
            THEN btrim(p."tags"[1])
        ELSE p."cat" || ' General'
    END AS category_name
FROM "Product" p;

-- One row per category name; ties on section broken by lowest product id.
INSERT INTO "Category" ("id", "name", "svgLogo", "sectionId", "sort")
SELECT
    gen_random_uuid()::text,
    m.category_name,
    '',
    s."id",
    0
FROM (
    SELECT DISTINCT ON (category_name) category_name, section_name
    FROM product_category_map
    ORDER BY category_name, product_id
) AS m
JOIN "Section" s ON s."name" = m.section_name
ON CONFLICT ("name") DO NOTHING;

-- ============================================================
-- 4. Product.categoryId
-- ============================================================

ALTER TABLE "Product" ADD COLUMN "categoryId" TEXT;

UPDATE "Product" p
SET "categoryId" = c."id"
FROM product_category_map m
JOIN "Category" c ON c."name" = m.category_name
WHERE p."id" = m.product_id;

ALTER TABLE "Product" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "Product" DROP COLUMN "cat";
ALTER TABLE "Product" DROP COLUMN "tags";

CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE product_category_map;

-- ============================================================
-- 5. Solution -> Service (rename in place, data preserved)
-- ============================================================

ALTER TABLE "Solution" RENAME TO "Service";
ALTER TABLE "Service" RENAME CONSTRAINT "Solution_pkey" TO "Service_pkey";
ALTER INDEX "Solution_slug_key" RENAME TO "Service_slug_key";

ALTER TABLE "Service" RENAME COLUMN "title" TO "name";
ALTER TABLE "Service" RENAME COLUMN "detail" TO "dsc";
ALTER TABLE "Service" RENAME COLUMN "items" TO "features";

ALTER TABLE "Service" ALTER COLUMN "features" SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Service" DROP COLUMN "icon";
ALTER TABLE "Service" ADD COLUMN "image" TEXT NOT NULL DEFAULT '';

-- ============================================================
-- 6. IndustrialService
-- ============================================================

CREATE TABLE "IndustrialService" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dsc" TEXT NOT NULL,
    "image" TEXT NOT NULL DEFAULT '',
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IndustrialService_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IndustrialService_slug_key" ON "IndustrialService"("slug");

-- ============================================================
-- 7. ServiceLead.serviceId
-- ============================================================

ALTER TABLE "ServiceLead" ADD COLUMN "serviceId" TEXT;

-- Leads were created from the solution cards, so the free text matches a
-- service name exactly in practice; compare case-insensitively to be safe.
UPDATE "ServiceLead" l
SET "serviceId" = s."id"
FROM "Service" s
WHERE lower(btrim(l."service")) = lower(s."name");

-- Anything left over (hand-entered, or a service since renamed) is parked on
-- a catch-all row rather than deleted.
INSERT INTO "Service" ("id", "slug", "name", "dsc", "image", "features", "sort")
SELECT gen_random_uuid()::text, 'other', 'Other / not listed', '', '', ARRAY[]::TEXT[], 999
WHERE EXISTS (SELECT 1 FROM "ServiceLead" WHERE "serviceId" IS NULL)
ON CONFLICT ("slug") DO NOTHING;

UPDATE "ServiceLead"
SET "serviceId" = (SELECT "id" FROM "Service" WHERE "slug" = 'other')
WHERE "serviceId" IS NULL;

ALTER TABLE "ServiceLead" ALTER COLUMN "serviceId" SET NOT NULL;
ALTER TABLE "ServiceLead" DROP COLUMN "service";

CREATE INDEX "ServiceLead_serviceId_idx" ON "ServiceLead"("serviceId");
ALTER TABLE "ServiceLead" ADD CONSTRAINT "ServiceLead_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
