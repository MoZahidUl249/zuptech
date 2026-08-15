-- A video for the campaign hero, shown in place of the pack shot.
--
-- Separate from the existing `videoUrl` (the demo section further down the
-- page) because the two answer different questions and a campaign may run
-- either, both, or neither. Blank is the default, so every existing campaign
-- keeps showing its product photo and nothing changes on deploy.
--
-- Written IF NOT EXISTS so it is re-runnable by hand: _prisma_migrations
-- stops it running twice through the CLI, but this file is also the thing an
-- operator pastes into psql when a deploy half-applied.
ALTER TABLE "LandingPage"
  ADD COLUMN IF NOT EXISTS "heroVideoUrl" TEXT NOT NULL DEFAULT '';
