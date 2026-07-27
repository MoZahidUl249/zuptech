-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('DIVISION', 'DISTRICT', 'CITY_CORPORATION', 'UPAZILA', 'THANA', 'CITY_CORP_AREA', 'UNION', 'WARD');

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "area",
ADD COLUMN     "areaId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "areaId" TEXT,
ADD COLUMN     "installationFee" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "installationFee" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "installationFee" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "ShippingCharge";

-- CreateTable
CREATE TABLE "LocationNode" (
    "id" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "deliveryCost" INTEGER NOT NULL DEFAULT 0,
    "installationCost" INTEGER NOT NULL DEFAULT 0,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LocationNode_type_idx" ON "LocationNode"("type");

-- CreateIndex
CREATE INDEX "LocationNode_parentId_idx" ON "LocationNode"("parentId");

-- CreateIndex
CREATE INDEX "Order_areaId_idx" ON "Order"("areaId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "LocationNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "LocationNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationNode" ADD CONSTRAINT "LocationNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LocationNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

