import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";

process.env.API_KEY ??= "test-api-key-1234567890";
// Always forced (not `??=`): Bun auto-loads .env before this file runs, so on any
// machine with a real .env present, `??=` would silently adopt the real STORAGE_ROOT
// — and afterAll() below recursively deletes it. Tests must never touch real data.
process.env.STORAGE_ROOT = join(import.meta.dir, "..", ".test-data");
process.env.DATABASE_URL ??= "postgres://media_storage:media_storage@localhost:5432/media_storage";

const { sql } = await import("../src/db");
const { ensureStorageRoot, CONFIG } = await import("../src/config");
const {
  uploadMedia,
  getMediaById,
  listMediaForEntity,
  deleteMedia,
  getVariant,
} = await import("../src/services/mediaService");

const FIXTURES = join(import.meta.dir, "fixtures");

async function fileOf(path: string, name: string, type: string): Promise<File> {
  const bytes = await Bun.file(path).arrayBuffer();
  return new File([bytes], name, { type });
}

beforeAll(async () => {
  await ensureStorageRoot();
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  const migrationSql = await Bun.file(join(import.meta.dir, "..", "migrations", "001_init.sql")).text();
  const applied = await sql`SELECT filename FROM schema_migrations WHERE filename = '001_init.sql'`;
  if (applied.length === 0) {
    await sql.unsafe(migrationSql);
    await sql`INSERT INTO schema_migrations (filename) VALUES ('001_init.sql')`;
  }
});

afterAll(async () => {
  await sql`DELETE FROM media WHERE entity_type = 'test-entity'`;
  await rm(CONFIG.storageRoot, { recursive: true, force: true });
  await sql.close();
});

describe("uploadMedia (image)", () => {
  test("generates original/thumbnail/medium variants and marks ready", async () => {
    const file = await fileOf(join(FIXTURES, "sample.jpg"), "sample.jpg", "image/jpeg");

    const media = await uploadMedia({
      file,
      entityType: "test-entity",
      entityId: "img-1",
      sortOrder: 0,
    });

    expect(media.status).toBe("ready");
    expect(media.media_type).toBe("image");
    expect(media.width).toBe(320);
    expect(media.height).toBe(240);

    const variantNames = media.variants.map((v) => v.variant).sort();
    expect(variantNames).toEqual(["medium", "original", "thumbnail"]);

    const thumb = media.variants.find((v) => v.variant === "thumbnail")!;
    expect(thumb.width).toBe(CONFIG.thumbnailSize);
    expect(thumb.height).toBe(CONFIG.thumbnailSize);

    const fetched = await getMediaById(media.id);
    expect(fetched?.id).toBe(media.id);
  });

  test("rejects unsupported mime types", async () => {
    const file = new File(["hello"], "note.txt", { type: "text/plain" });
    await expect(
      uploadMedia({ file, entityType: "test-entity", entityId: "bad-1", sortOrder: 0 })
    ).rejects.toThrow(/unsupported mime type/);
  });

  test("rejects unsafe entityId (path traversal attempt)", async () => {
    const file = await fileOf(join(FIXTURES, "sample.jpg"), "sample.jpg", "image/jpeg");
    await expect(
      uploadMedia({ file, entityType: "test-entity", entityId: "../../etc", sortOrder: 0 })
    ).rejects.toThrow(/entityId/);
  });
});

describe("uploadMedia (video)", () => {
  test("probes duration/dimensions and generates a poster variant", async () => {
    const file = await fileOf(join(FIXTURES, "sample.mp4"), "sample.mp4", "video/mp4");

    const media = await uploadMedia({
      file,
      entityType: "test-entity",
      entityId: "vid-1",
      sortOrder: 0,
    });

    expect(media.status).toBe("ready");
    expect(media.media_type).toBe("video");
    expect(media.width).toBe(320);
    expect(media.height).toBe(240);
    expect(media.duration_ms).toBeGreaterThan(0);

    const poster = media.variants.find((v) => v.variant === "poster");
    expect(poster).toBeDefined();
    expect(poster!.mime_type).toBe("image/jpeg");
  });
});

describe("listMediaForEntity / deleteMedia", () => {
  test("lists only ready items by default, ordered by sortOrder", async () => {
    const fileA = await fileOf(join(FIXTURES, "sample.jpg"), "a.jpg", "image/jpeg");
    const fileB = await fileOf(join(FIXTURES, "sample.jpg"), "b.jpg", "image/jpeg");

    await uploadMedia({ file: fileB, entityType: "test-entity", entityId: "list-1", sortOrder: 2 });
    await uploadMedia({ file: fileA, entityType: "test-entity", entityId: "list-1", sortOrder: 1 });

    const items = await listMediaForEntity("test-entity", "list-1", false);
    expect(items.length).toBe(2);
    expect(items[0]!.original_filename).toBe("a.jpg");
    expect(items[1]!.original_filename).toBe("b.jpg");
  });

  test("delete removes DB rows and files from disk", async () => {
    const file = await fileOf(join(FIXTURES, "sample.jpg"), "c.jpg", "image/jpeg");
    const media = await uploadMedia({ file, entityType: "test-entity", entityId: "del-1", sortOrder: 0 });

    const variant = await getVariant(media.id, "original");
    expect(variant).not.toBeNull();
    const path = join(CONFIG.storageRoot, variant!.storage_path);
    expect(await Bun.file(path).exists()).toBe(true);

    const deleted = await deleteMedia(media.id);
    expect(deleted).toBe(true);

    expect(await getMediaById(media.id)).toBeNull();
    expect(await Bun.file(path).exists()).toBe(false);
  });

  test("delete returns false for unknown id", async () => {
    const deleted = await deleteMedia("00000000-0000-0000-0000-000000000000");
    expect(deleted).toBe(false);
  });
});
