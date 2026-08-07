-- Two changes, both about telling things apart that were tangled together.
--
-- 1. ShowcaseCard: the home page's own cards. It used to render the `Service`
--    rows, so editing the front page edited what /services sells. Nothing
--    books a showcase card, so there is no lead relation here.
--
-- 2. ServiceLead.city -> address, plus an email column. `city` was required
--    with a two-character minimum, which is why the booking form posted the
--    literal "Not given" when nobody filled it in. RENAME rather than
--    drop-and-add so existing rows keep the location they were captured with.

-- CreateTable
CREATE TABLE "ShowcaseCard" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dsc" TEXT NOT NULL,
    "image" TEXT NOT NULL DEFAULT '',
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sort" INTEGER NOT NULL DEFAULT 0,
    "imageSide" TEXT NOT NULL DEFAULT 'left',
    "bulletStyle" TEXT NOT NULL DEFAULT 'tick',

    CONSTRAINT "ShowcaseCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShowcaseCard_slug_key" ON "ShowcaseCard"("slug");

-- AlterTable
ALTER TABLE "ServiceLead" RENAME COLUMN "city" TO "address";
ALTER TABLE "ServiceLead" ALTER COLUMN "address" SET DEFAULT '';
ALTER TABLE "ServiceLead" ADD COLUMN     "email" TEXT NOT NULL DEFAULT '';
