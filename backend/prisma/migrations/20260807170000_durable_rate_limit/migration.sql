-- Durable rate limiting for the auth endpoints.
--
-- The limiter was a Map in the process, so every deploy reset it: a
-- brute-force attempt only had to wait for a restart, and the counts would
-- have been per-instance the moment this ran on more than one container.
--
-- Only the auth paths write here. Pricing quotes, lead forms and campaign view
-- counts stay in memory on purpose — they are high-volume and low-stakes, and
-- a row per request would cost more than the abuse it prevents.

-- CreateTable
CREATE TABLE "RateLimitHit" (
    "id" BIGSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Serves the only query there is: count hits for one key inside a window.
CREATE INDEX "RateLimitHit_key_at_idx" ON "RateLimitHit"("key", "at");
