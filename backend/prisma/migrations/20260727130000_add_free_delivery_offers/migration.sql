-- CreateTable
CREATE TABLE "FreeDeliveryOffer" (
    "id" SERIAL NOT NULL,
    "productId" TEXT NOT NULL,
    "minQty" INTEGER NOT NULL,
    "percentage" INTEGER NOT NULL,

    CONSTRAINT "FreeDeliveryOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FreeDeliveryOffer_productId_idx" ON "FreeDeliveryOffer"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "FreeDeliveryOffer_productId_minQty_key" ON "FreeDeliveryOffer"("productId", "minQty");

-- AddForeignKey
ALTER TABLE "FreeDeliveryOffer" ADD CONSTRAINT "FreeDeliveryOffer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: the old scalar threshold was all-or-nothing, i.e. 100% off.
INSERT INTO "FreeDeliveryOffer" ("productId", "minQty", "percentage")
SELECT "id", "freeDeliveryMinQty", 100 FROM "Product" WHERE "freeDeliveryMinQty" > 0;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "freeDeliveryMinQty";
