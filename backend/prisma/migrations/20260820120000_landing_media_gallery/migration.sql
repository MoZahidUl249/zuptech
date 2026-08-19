-- Campaign-owned media: a mixed photo/video gallery, and multiple quality photos.
--
-- A campaign row held exactly one picture (`qcImage`) and one demo video
-- (`videoUrl`). Both blocks are now galleries, so both need an ordered list.
--
-- `galleryItems` is JSONB and `qcImages` is TEXT[] on purpose. The gallery is
-- heterogeneous — a bare URL cannot say whether it is a picture or a clip, and
-- the renderer branches on that — so the kind is stored beside the URL. The
-- quality photos are homogeneous, so they are exactly `Product.photos`.
--
-- JSONB rather than JSON because Prisma maps `Json` to jsonb on Postgres;
-- JSON here would leave `prisma migrate diff` permanently dirty.
--
-- Re-runnable by hand, like the rest: the CLI won't apply it twice, but this
-- file is also what gets pasted into psql when a deploy half-applies.
ALTER TABLE "LandingPage"
  ADD COLUMN IF NOT EXISTS "galleryItems" JSONB  NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "qcImages"     TEXT[] NOT NULL DEFAULT '{}';

-- Carry the single quality picture in, so no published campaign loses its
-- photo the moment this deploys.
UPDATE "LandingPage"
   SET "qcImages" = ARRAY["qcImage"]
 WHERE "qcImage" <> '' AND cardinality("qcImages") = 0;

-- Carry the demo video in as the gallery's first slide, for the same reason.
UPDATE "LandingPage"
   SET "galleryItems" = jsonb_build_array(
         jsonb_build_object('url', "videoUrl", 'kind', 'video', 'alt', ''))
 WHERE "videoUrl" <> '' AND jsonb_array_length("galleryItems") = 0;

-- Blank the two legacy columns, so exactly ONE row owns each Cloudinary URL.
-- Without this, deleting gallery item 0 would free a file `videoUrl` still
-- points at — a broken video on a live campaign, and no way to tell why.
--
-- Rollback caveat: reverting the CODE after this migration shows the striped
-- placeholder again, because these two columns are now blank. Nothing is lost
-- — the values are in the new columns — and recovery is one UPDATE per column.
UPDATE "LandingPage" SET "qcImage"  = '' WHERE "qcImage"  <> '';
UPDATE "LandingPage" SET "videoUrl" = '' WHERE "videoUrl" <> '';
