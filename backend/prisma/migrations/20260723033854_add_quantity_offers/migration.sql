-- CreateTable
CREATE TABLE "QuantityOffer" (
    "id" SERIAL NOT NULL,
    "productId" TEXT NOT NULL,
    "minQty" INTEGER NOT NULL,
    "percentage" INTEGER NOT NULL,

    CONSTRAINT "QuantityOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuantityOffer_productId_idx" ON "QuantityOffer"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "QuantityOffer_productId_minQty_key" ON "QuantityOffer"("productId", "minQty");

-- AddForeignKey
ALTER TABLE "QuantityOffer" ADD CONSTRAINT "QuantityOffer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
