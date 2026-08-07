/**
 * Repair media URLs that were stored with the in-network storage origin.
 *
 * Uploads used to persist `${STORAGE_URL}/files/...`, and under compose
 * STORAGE_URL is `http://storage:3100` — a hostname that only resolves inside
 * the Docker network. Every image uploaded through the admin therefore went
 * into the database with an origin no browser can reach, and rendered as a
 * broken <img> forever. src/lib/storage.ts now stores STORAGE_PUBLIC_URL
 * instead; this rewrites the rows written before that.
 *
 * Dry run by default — prints what it would change and touches nothing:
 *
 *   docker compose --env-file .env.production run --rm backend \
 *     bun run prisma/fix-media-urls.ts
 *
 * Apply it:
 *
 *   docker compose --env-file .env.production run --rm backend \
 *     bun run prisma/fix-media-urls.ts --apply
 *
 * Safe to re-run: it only rewrites strings that still start with the old
 * origin, so a second pass finds nothing. Override the origins with
 * OLD_STORAGE_URL / STORAGE_PUBLIC_URL if yours differ.
 */
import { prisma } from "../src/lib/db";

const APPLY = process.argv.includes("--apply");

const OLD = (process.env.OLD_STORAGE_URL || process.env.STORAGE_URL || "http://storage:3100")
  .replace(/\/$/, "");
const NEW = (process.env.STORAGE_PUBLIC_URL || "").replace(/\/$/, "");

if (!NEW) {
  console.error(
    "STORAGE_PUBLIC_URL is not set — nothing to rewrite to.\n" +
      "Set it to the public media origin (e.g. https://media.example.com) and re-run.",
  );
  process.exit(1);
}
if (OLD === NEW) {
  console.error(`Old and new origins are identical (${OLD}) — nothing to do.`);
  process.exit(1);
}

const prefix = `${OLD}/files/`;
const rewrite = (url: string): string =>
  url.startsWith(prefix) ? `${NEW}/files/${url.slice(prefix.length)}` : url;

let found = 0;

/** Rewrite one plain string column. */
async function fixScalar(
  model: string,
  field: string,
  rows: { id: string; value: string | null }[],
  update: (id: string, value: string) => Promise<unknown>,
): Promise<void> {
  for (const row of rows) {
    if (!row.value) continue;
    const next = rewrite(row.value);
    if (next === row.value) continue;
    found++;
    console.log(`  ${model}.${field} [${row.id}]\n    - ${row.value}\n    + ${next}`);
    if (APPLY) await update(row.id, next);
  }
}

async function run(): Promise<void> {
  console.log(`${APPLY ? "Rewriting" : "Dry run —"} ${OLD}/files/  ->  ${NEW}/files/\n`);

  // Product.photos is a string ARRAY, so it needs a per-element rewrite rather
  // than the scalar helper.
  const products = await prisma.product.findMany({ select: { id: true, photos: true, video: true } });
  for (const p of products) {
    const photos = p.photos.map(rewrite);
    if (photos.some((url, i) => url !== p.photos[i])) {
      found++;
      console.log(`  Product.photos [${p.id}]\n    - ${p.photos.join("\n      ")}\n    + ${photos.join("\n      ")}`);
      if (APPLY) await prisma.product.update({ where: { id: p.id }, data: { photos } });
    }
  }
  await fixScalar(
    "Product",
    "video",
    products.map((p) => ({ id: p.id, value: p.video })),
    (id, video) => prisma.product.update({ where: { id }, data: { video } }),
  );

  await fixScalar(
    "HeroSlide",
    "image",
    (await prisma.heroSlide.findMany({ select: { id: true, image: true } })).map((r) => ({
      id: String(r.id),
      value: r.image,
    })),
    (id, image) => prisma.heroSlide.update({ where: { id }, data: { image } }),
  );

  await fixScalar(
    "Service",
    "image",
    (await prisma.service.findMany({ select: { id: true, image: true } })).map((r) => ({
      id: String(r.id),
      value: r.image,
    })),
    (id, image) => prisma.service.update({ where: { id }, data: { image } }),
  );

  await fixScalar(
    "IndustrialService",
    "image",
    (await prisma.industrialService.findMany({ select: { id: true, image: true } })).map((r) => ({
      id: String(r.id),
      value: r.image,
    })),
    (id, image) => prisma.industrialService.update({ where: { id }, data: { image } }),
  );

  console.log();
  if (found === 0) {
    console.log("No rows hold the old origin — nothing to fix.");
  } else if (APPLY) {
    console.log(`Rewrote ${found} value(s).`);
  } else {
    console.log(`${found} value(s) would be rewritten. Re-run with --apply to write them.`);
  }
}

run()
  .catch((err) => {
    console.error("fix-media-urls failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
