-- The courier's API address becomes configuration.
--
-- It was a constant in lib/shipping/steadfast.ts, which made a host change a
-- deploy. Existing API couriers are backfilled with the value that constant
-- held, so nothing changes behaviour on the way through this migration.

-- AlterTable
ALTER TABLE "Courier" ADD COLUMN     "baseUrl" TEXT NOT NULL DEFAULT '';

-- Backfill: an already-configured Steadfast keeps working without anyone
-- touching the admin screen. Only rows that actually call an API get a URL —
-- self-delivery and manual couriers call nobody and keep it blank.
UPDATE "Courier"
   SET "baseUrl" = 'https://portal.steadfast.com.bd/api/v1'
 WHERE provider = 'steadfast' AND "baseUrl" = '';
