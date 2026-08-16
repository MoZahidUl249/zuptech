-- A real picture for the campaign's quality block.
--
-- `qcImageHint` was only ever a note describing the art that belonged there,
-- and the renderer drew a striped grey wireframe captioned with it. Landing
-- pages had no image upload of their own, so that placeholder was permanent on
-- every published campaign. This is the column the upload writes to; blank
-- keeps the old placeholder, so nothing changes for an existing page.
--
-- Re-runnable by hand, like the rest: the CLI won't apply it twice, but this
-- file is also what gets pasted into psql when a deploy half-applies.
ALTER TABLE "LandingPage"
  ADD COLUMN IF NOT EXISTS "qcImage" TEXT NOT NULL DEFAULT '';
