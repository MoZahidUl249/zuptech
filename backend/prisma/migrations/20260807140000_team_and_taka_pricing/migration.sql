-- Two changes.
--
-- 1. TeamMember — the people on the contact page. Seeded empty on purpose: the
--    roster that used to be hardcoded in the frontend was invented, and
--    publishing fabricated staff for a real business is worse than publishing
--    none.
--
-- 2. Every percentage in the money path becomes a flat BDT amount. Percentages
--    forced staff to do arithmetic in their heads and produced three different
--    roundings of the same number (server floored, admin preview rounded,
--    product card rounded again off a different base). Flat Taka has nothing
--    left to round.
--
--    Data is CONVERTED, not reset — each UPDATE below reproduces what the old
--    percentage actually charged, so no customer sees a price change.

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "photo" TEXT NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- AlterTable — Product.salePercentage -> salePrice (what the customer pays).
-- Mirrors the old salePrice(): price - floor(price * pct / 100).
ALTER TABLE "Product" ADD COLUMN     "salePrice" INTEGER NOT NULL DEFAULT 0;
UPDATE "Product"
   SET "salePrice" = "price" - FLOOR("price" * "salePercentage" / 100.0)
 WHERE "onSale";
ALTER TABLE "Product" DROP COLUMN "salePercentage";

-- AlterTable — Product.minDp (% of price) -> minDeposit (the deposit itself).
-- Mirrors the old minDownPayment(): ceil(price * minDp / 100).
ALTER TABLE "Product" ADD COLUMN     "minDeposit" INTEGER NOT NULL DEFAULT 0;
UPDATE "Product" SET "minDeposit" = CEIL("price" * "minDp" / 100.0);
ALTER TABLE "Product" DROP COLUMN "minDp";

-- AlterTable — QuantityOffer.percentage -> amount off each unit.
ALTER TABLE "QuantityOffer" ADD COLUMN     "amount" INTEGER NOT NULL DEFAULT 0;
UPDATE "QuantityOffer" o
   SET "amount" = FLOOR(p."price" * o."percentage" / 100.0)
  FROM "Product" p
 WHERE p."id" = o."productId";
ALTER TABLE "QuantityOffer" DROP COLUMN "percentage";

-- AlterTable — FreeDeliveryOffer.percentage -> amount off the delivery fee.
--
-- A tier applies to whichever zone fee the order resolves to, and the two zones
-- differ, so a single amount cannot reproduce a percentage in both. Convert off
-- the inside-Dhaka fee, EXCEPT for a 100% tier: "free" has to stay free in both
-- zones, so it takes the larger of the two fees and the clamp in
-- discountedDeliveryFee() does the rest.
ALTER TABLE "FreeDeliveryOffer" ADD COLUMN     "amount" INTEGER NOT NULL DEFAULT 0;
UPDATE "FreeDeliveryOffer" o
   SET "amount" = CASE
     WHEN o."percentage" >= 100
       THEN GREATEST(p."deliveryFeeInsideDhaka", p."deliveryFeeOutsideDhaka")
     ELSE FLOOR(p."deliveryFeeInsideDhaka" * o."percentage" / 100.0)
   END
  FROM "Product" p
 WHERE p."id" = o."productId";
ALTER TABLE "FreeDeliveryOffer" DROP COLUMN "percentage";
