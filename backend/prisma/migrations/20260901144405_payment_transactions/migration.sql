-- Payment attempts through a gateway (EPS).
--
-- Purely additive: no existing column changes meaning, so an order placed
-- before this migration behaves afterwards exactly as it did before.
--
-- NOTE: `prisma migrate dev` also wanted to drop the DEFAULT 0 on
-- QuantityOffer.amount and FreeDeliveryOffer.amount. That is pre-existing
-- drift from 20260807140000 (the columns were added WITH a default to
-- backfill; the schema declares none) and has nothing to do with payments,
-- so it is deliberately left out of this migration rather than smuggled in.

-- AlterTable
ALTER TABLE "PaymentMethod" ADD COLUMN     "credentials" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "merchantTxnId" TEXT NOT NULL,
    "providerTxnId" TEXT NOT NULL DEFAULT '',
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Initiated',
    "redirectUrl" TEXT NOT NULL DEFAULT '',
    "raw" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_merchantTxnId_key" ON "PaymentTransaction"("merchantTxnId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_orderId_idx" ON "PaymentTransaction"("orderId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
