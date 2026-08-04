import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { classifyAndValidate, classifyMimeType, contentMatchesMimeType, SNIFF_BYTES } from "./media-validate";

const FIXTURES = join(import.meta.dir, "..", "..", "test", "fixtures");

async function head(path: string): Promise<Uint8Array> {
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  return bytes.slice(0, SNIFF_BYTES);
}

const bytesOf = (...values: number[]) => new Uint8Array(values);
const ascii = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

async function fileFrom(path: string, type: string): Promise<File> {
  const buffer = await Bun.file(path).arrayBuffer();
  return new File([buffer], path.split("/").pop()!, { type });
}

describe("contentMatchesMimeType", () => {
  test("accepts the real fixtures", async () => {
    expect(contentMatchesMimeType(await head(join(FIXTURES, "sample.jpg")), "image/jpeg")).toBe(true);
    expect(contentMatchesMimeType(await head(join(FIXTURES, "sample.mp4")), "video/mp4")).toBe(true);
  });

  /**
   * The point of the check: `file.type` is client-supplied and is what gets
   * stored on the row and later replayed to the browser as this asset's
   * type, so bytes that aren't the declared type must not be accepted.
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
  });

  test("truncated input can't match", () => {
    expect(contentMatchesMimeType(bytesOf(0xff), "image/jpeg")).toBe(false);
    expect(contentMatchesMimeType(new Uint8Array(), "image/jpeg")).toBe(false);
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
  });
});

describe("classifyAndValidate", () => {
  test("accepts a real jpeg declared correctly", async () => {
    const file = await fileFrom(join(FIXTURES, "sample.jpg"), "image/jpeg");
    const { mediaType } = await classifyAndValidate(file);
    expect(mediaType).toBe("image");
  });

  test("accepts a real mp4 declared correctly", async () => {
    const file = await fileFrom(join(FIXTURES, "sample.mp4"), "video/mp4");
    const { mediaType } = await classifyAndValidate(file);
    expect(mediaType).toBe("video");
  });

  test("rejects an unsupported declared type", async () => {
    const file = await fileFrom(join(FIXTURES, "sample.jpg"), "image/svg+xml");
    await expect(classifyAndValidate(file)).rejects.toMatchObject({ statusCode: 415 });
  });

  test("rejects a jpeg mislabeled as png (content sniff catches the spoof)", async () => {
    const file = await fileFrom(join(FIXTURES, "sample.jpg"), "image/png");
    await expect(classifyAndValidate(file)).rejects.toMatchObject({ statusCode: 415 });
  });

  test("rejects a file over the size limit", async () => {
    const oversized = new File([new Uint8Array(500 * 1024 * 1024 + 1)], "big.jpg", {
      type: "image/jpeg",
    });
    await expect(classifyAndValidate(oversized)).rejects.toMatchObject({ statusCode: 413 });
  });
});
