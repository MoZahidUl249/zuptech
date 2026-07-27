-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "address" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "area" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Cart" (
    "customerId" TEXT NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("customerId")
);

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

