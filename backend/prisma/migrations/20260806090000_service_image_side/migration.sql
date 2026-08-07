-- Which half of the 50/50 storefront card each service card's photo takes.
-- Defaulted so existing rows keep the layout they already render with.

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "imageSide" TEXT NOT NULL DEFAULT 'left';

-- AlterTable
ALTER TABLE "IndustrialService" ADD COLUMN     "imageSide" TEXT NOT NULL DEFAULT 'left';
