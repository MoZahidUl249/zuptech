/**
 * One-off: re-upload every file still on the old media-storage service to
 * Cloudinary, and rewrite the database columns that point at it.
 *
 * Run this BEFORE decommissioning the old storage service — it fetches the
 * bytes from there, so the service (and its data volume) must still be
 * reachable. Requires CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/
 * CLOUDINARY_API_SECRET to be set (see backend/.env.example).
 *
 * Dry run by default — prints what it would change and uploads nothing:
 *
 *   OLD_STORAGE_URL=https://media.zuptech.com \
 *     bun run prisma/migrate-media-to-cloudinary.ts
 *
 * Apply it:
 *
 *   OLD_STORAGE_URL=https://media.zuptech.com \
 *     bun run prisma/migrate-media-to-cloudinary.ts --apply
 *
 * Safe to re-run: any URL that already looks like a Cloudinary delivery URL
 * is skipped, so a second pass only picks up rows a previous run missed
 * (e.g. one that failed a fetch). URLs that don't start with the old
 * storage origin are left untouched on purpose — `Product.photos` can
 * legitimately hold external URLs from prisma/import-zupplus.ts that were
 * never on our storage service and don't need re-hosting.
 */
import { prisma } from "../src/lib/db";
import { uploadMedia } from "../src/lib/storage";

const APPLY = process.argv.includes("--apply");

const OLD_ORIGIN = (
  process.env.OLD_STORAGE_URL ||
  process.env.STORAGE_PUBLIC_URL ||
  process.env.STORAGE_URL ||
  "http://storage:3100"
).replace(/\/$/, "");
const OLD_PREFIX = `${OLD_ORIGIN}/files/`;

let candidates = 0;
let migrated = 0;
let failed = 0;

function isOurs(url: string): boolean {
  return url.startsWith(OLD_PREFIX);
}

function isAlreadyCloudinary(url: string): boolean {
  return url.startsWith("https://res.cloudinary.com/");
}

/** Re-uploads one file from the old service to Cloudinary; null on failure. */
async function migrateOne(
  url: string,
  entityType: string,
  entityId: string,
  sortOrder: number,
): Promise<string | null> {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`    ! fetch failed (${res.status}): ${url}`);
    failed++;
    return null;
  }
  const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
  const buffer = await res.arrayBuffer();
  const filename = url.split("/").pop() || "file";
  const file = new File([buffer], filename, { type: mimeType });

  try {
    const media = await uploadMedia(file, entityType, entityId, sortOrder);
    migrated++;
    return media.url;
  } catch (err) {
    console.error(`    ! upload failed: ${url}\n      ${(err as Error).message}`);
    failed++;
    return null;
  }
}

/** Rewrite one plain string column. */
async function migrateScalar(
  model: string,
  field: string,
  rows: { id: string; value: string | null; entityType: string; entityId: string }[],
  update: (id: string, value: string) => Promise<unknown>,
): Promise<void> {
  for (const row of rows) {
    if (!row.value || isAlreadyCloudinary(row.value) || !isOurs(row.value)) continue;
    console.log(`  ${model}.${field} [${row.id}]\n    - ${row.value}`);
    candidates++;
    if (!APPLY) continue;
    const next = await migrateOne(row.value, row.entityType, row.entityId, 0);
    if (next) {
      console.log(`    + ${next}`);
      await update(row.id, next);
    }
  }
}

async function run(): Promise<void> {
  console.log(
    `${APPLY ? "Migrating" : "Dry run —"} media under ${OLD_PREFIX} to Cloudinary\n`,
  );

  const products = await prisma.product.findMany({
    select: { id: true, photos: true, video: true },
  });
  for (const p of products) {
    for (const [index, url] of p.photos.entries()) {
      if (!url || isAlreadyCloudinary(url) || !isOurs(url)) continue;
      console.log(`  Product.photos[${index}] [${p.id}]\n    - ${url}`);
      candidates++;
      if (!APPLY) continue;
      const next = await migrateOne(url, "product", p.id, index);
      if (next) {
        console.log(`    + ${next}`);
        const fresh = await prisma.product.findUniqueOrThrow({
          where: { id: p.id },
          select: { photos: true },
        });
        const photos = [...fresh.photos];
        photos[index] = next;
        await prisma.product.update({ where: { id: p.id }, data: { photos } });
      }
    }
  }
  await migrateScalar(
    "Product",
    "video",
    products.map((p) => ({ id: p.id, value: p.video, entityType: "product", entityId: p.id })),
    (id, video) => prisma.product.update({ where: { id }, data: { video } }),
  );

  const heroes = await prisma.pageHero.findMany({ select: { id: true, pageKey: true, background: true } });
  await migrateScalar(
    "PageHero",
    "background",
    heroes.map((h) => ({
      id: String(h.id),
      value: h.background,
      entityType: "pagehero",
      entityId: h.pageKey,
    })),
    (id, background) => prisma.pageHero.update({ where: { id }, data: { background } }),
  );

  const posters = await prisma.heroPoster.findMany({ select: { id: true, image: true } });
  await migrateScalar(
    "HeroPoster",
    "image",
    posters.map((p) => ({
      id: p.id,
      value: p.image,
      entityType: "heroposter",
      entityId: crypto.randomUUID(),
    })),
    (id, image) => prisma.heroPoster.update({ where: { id }, data: { image } }),
  );

  const slides = await prisma.heroSlide.findMany({ select: { id: true, image: true } });
  await migrateScalar(
    "HeroSlide",
    "image",
    slides.map((s) => ({
      id: String(s.id),
      value: s.image,
      entityType: "heroslide",
      entityId: crypto.randomUUID(),
    })),
    (id, image) => prisma.heroSlide.update({ where: { id }, data: { image } }),
  );

  const services = await prisma.service.findMany({ select: { id: true, image: true } });
  await migrateScalar(
    "Service",
    "image",
    services.map((s) => ({ id: s.id, value: s.image, entityType: "service", entityId: s.id })),
    (id, image) => prisma.service.update({ where: { id }, data: { image } }),
  );

  const industrial = await prisma.industrialService.findMany({ select: { id: true, image: true } });
  await migrateScalar(
    "IndustrialService",
    "image",
    industrial.map((s) => ({
      id: s.id,
      value: s.image,
      entityType: "industrialservice",
      entityId: s.id,
    })),
    (id, image) => prisma.industrialService.update({ where: { id }, data: { image } }),
  );

  console.log();
  if (candidates === 0) {
    console.log("No rows hold the old origin — nothing to migrate.");
  } else if (APPLY) {
    console.log(`Migrated ${migrated} file(s), ${failed} failure(s).`);
    if (failed > 0) process.exitCode = 1;
  } else {
    console.log(`${candidates} value(s) would be migrated. Re-run with --apply to upload them.`);
  }
}

run()
  .catch((err) => {
    console.error("migrate-media-to-cloudinary failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
