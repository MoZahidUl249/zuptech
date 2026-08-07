-- The marker in front of each feature line on a service card: tick, dot or
-- nothing. Defaulted to the tick every existing card already renders.

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "bulletStyle" TEXT NOT NULL DEFAULT 'tick';

-- AlterTable
ALTER TABLE "IndustrialService" ADD COLUMN     "bulletStyle" TEXT NOT NULL DEFAULT 'tick';
