-- SMS provider configuration and per-message switches.
--
-- Additive, and its own table on purpose: SiteConfig is served by the public
-- /api/site-config endpoint, so credentials must not live there.
--
-- The row is created on first read (upsert), so there is no seed dependency
-- and an unconfigured install simply sends nothing.

-- CreateTable
CREATE TABLE "SmsSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'mimsms',
    "username" TEXT NOT NULL DEFAULT '',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "senderId" TEXT NOT NULL DEFAULT '',
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.mimsms.com',
    "otpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "placedEnabled" BOOLEAN NOT NULL DEFAULT true,
    "shippedEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deliveredEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsSettings_pkey" PRIMARY KEY ("id")
);
