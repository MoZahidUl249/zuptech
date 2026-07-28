import { describe, expect, test } from "bun:test";
import { join } from "node:path";

process.env.API_KEY ??= "test-api-key-1234567890";
process.env.STORAGE_ROOT ??= join(import.meta.dir, "..", ".test-data");
process.env.DATABASE_URL ??= "postgres://media_storage:media_storage@localhost:5432/media_storage";

const { contentMatchesMimeType, classifyMimeType, SNIFF_BYTES } = await import("../src/lib/mime");

const FIXTURES = join(import.meta.dir, "fixtures");

async function head(path: string): Promise<Uint8Array> {
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  return bytes.slice(0, SNIFF_BYTES);
}

const bytesOf = (...values: number[]) => new Uint8Array(values);
const ascii = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe("contentMatchesMimeType", () => {
  test("accepts the real fixtures", async () => {
    expect(contentMatchesMimeType(await head(join(FIXTURES, "sample.jpg")), "image/jpeg")).toBe(true);
    expect(contentMatchesMimeType(await head(join(FIXTURES, "sample.mp4")), "video/mp4")).toBe(true);
  });

  /**
   * The point of the check: `file.type` is client-supplied and is what this
   * service later replays as Content-Type, so bytes that aren't the declared
   * type must not be stored under it.
   */
  test("rejects a file whose declared type isn't its content", async () => {
    const jpeg = await head(join(FIXTURES, "sample.jpg"));
    expect(contentMatchesMimeType(jpeg, "image/png")).toBe(false);
    expect(contentMatchesMimeType(ascii("<html><script>"), "image/gif")).toBe(false);
    expect(contentMatchesMimeType(ascii("GIF89a<script>"), "image/jpeg")).toBe(false);
  });

  test("recognises each allowed image signature", () => {
    expect(contentMatchesMimeType(bytesOf(0xff, 0xd8, 0xff, 0xe0), "image/jpeg")).toBe(true);
    expect(
      contentMatchesMimeType(bytesOf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "image/png"),
    ).toBe(true);
    expect(contentMatchesMimeType(ascii("GIF89a...."), "image/gif")).toBe(true);
    expect(contentMatchesMimeType(ascii("GIF87a...."), "image/gif")).toBe(true);
  });

  test("webp needs both RIFF and WEBP markers, not just RIFF", () => {
    expect(contentMatchesMimeType(ascii("RIFF????WEBPVP8 "), "image/webp")).toBe(true);
    // A RIFF container that isn't WebP (e.g. a .wav) must not pass.
    expect(contentMatchesMimeType(ascii("RIFF????WAVEfmt "), "image/webp")).toBe(false);
  });

  test("recognises the video containers", () => {
    expect(contentMatchesMimeType(ascii("\0\0\0 ftypisom"), "video/mp4")).toBe(true);
    expect(contentMatchesMimeType(ascii("\0\0\0 ftypqt  "), "video/quicktime")).toBe(true);
    expect(contentMatchesMimeType(bytesOf(0x1a, 0x45, 0xdf, 0xa3, 0x01), "video/webm")).toBe(true);
  });

  test("a type with no signature on file is never accepted", () => {
    expect(contentMatchesMimeType(ascii("whatever"), "image/svg+xml")).toBe(false);
    expect(contentMatchesMimeType(ascii("whatever"), "application/octet-stream")).toBe(false);
    expect(contentMatchesMimeType(ascii("whatever"), "text/html")).toBe(false);
  });

  test("truncated input can't match", () => {
    expect(contentMatchesMimeType(bytesOf(0xff), "image/jpeg")).toBe(false);
    expect(contentMatchesMimeType(new Uint8Array(), "image/jpeg")).toBe(false);
  });

  test("the sniff window covers the furthest signature offset", () => {
    // WEBP sits at offset 8..11; anything shorter would silently never match.
    expect(SNIFF_BYTES).toBeGreaterThanOrEqual(12);
  });
});

describe("classifyMimeType", () => {
  test("splits the allowed types by media kind", () => {
    expect(classifyMimeType("image/png")).toBe("image");
    expect(classifyMimeType("video/mp4")).toBe("video");
  });
  test("refuses anything off the allowlist", () => {
    expect(classifyMimeType("text/html")).toBeNull();
    expect(classifyMimeType("image/svg+xml")).toBeNull();
    expect(classifyMimeType("application/octet-stream")).toBeNull();
  });
});
