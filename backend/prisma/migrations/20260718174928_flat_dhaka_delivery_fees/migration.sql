-- DropForeignKey
ALTER TABLE "Customer" DROP CONSTRAINT IF EXISTS "Customer_areaId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_areaId_fkey";

-- DropForeignKey
ALTER TABLE "LocationNode" DROP CONSTRAINT IF EXISTS "LocationNode_parentId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Order_areaId_idx";

-- AlterTable: Product — replace flat installationFee with four zone-specific fee fields
ALTER TABLE "Product"
  ADD COLUMN     "deliveryFeeInsideDhaka" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN     "deliveryFeeOutsideDhaka" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN     "installationFeeInsideDhaka" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN     "installationFeeOutsideDhaka" INTEGER NOT NULL DEFAULT 0,
  DROP COLUMN    "installationFee";

-- AlterTable: Customer — areaId -> insideDhaka
ALTER TABLE "Customer"
  DROP COLUMN "areaId",
  ADD COLUMN  "insideDhaka" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: Order — areaId -> insideDhaka (backfilled true for existing rows, then made explicit going forward)
ALTER TABLE "Order"
  DROP COLUMN "areaId",
  ADD COLUMN  "insideDhaka" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Order" ALTER COLUMN "insideDhaka" DROP DEFAULT;

-- AlterTable: OrderItem — per-unit delivery fee snapshot, parallel to the existing installationFee snapshot
ALTER TABLE "OrderItem" ADD COLUMN "deliveryFee" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "LocationNode";

-- DropEnum
DROP TYPE "LocationType";
