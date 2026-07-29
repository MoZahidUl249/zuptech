import { afterEach, describe, expect, test } from "bun:test";
import { parseMediaId } from "./storage";

/*
 * These cover the split between the two storage origins.
 *
 * Production sets STORAGE_URL to the in-network `http://storage:3100` and
 * STORAGE_PUBLIC_URL to the browser-facing `https://media.<domain>`. Media
 * URLs are persisted and later rendered in an <img>, so they must carry the
 * public origin — storing the in-network one breaks every uploaded image
 * permanently, which is what shipped before this split existed.
 */

const INTERNAL = "http://storage:3100";
const PUBLIC = "https://media.zuptech.com";

const original = {
  url: process.env.STORAGE_URL,
  publicUrl: process.env.STORAGE_PUBLIC_URL,
};

afterEach(() => {
  // Restore rather than delete — an unrelated suite may rely on these.
  if (original.url === undefined) delete process.env.STORAGE_URL;
  else process.env.STORAGE_URL = original.url;
  if (original.publicUrl === undefined) delete process.env.STORAGE_PUBLIC_URL;
  else process.env.STORAGE_PUBLIC_URL = original.publicUrl;
});

describe("parseMediaId", () => {
  test("reads an id from a public-origin URL", () => {
    process.env.STORAGE_URL = INTERNAL;
    process.env.STORAGE_PUBLIC_URL = PUBLIC;
    expect(parseMediaId(`${PUBLIC}/files/abc-123/medium`)).toBe("abc-123");
  });

  // The reason parseMediaId checks both origins: rows written before
  // STORAGE_PUBLIC_URL existed still hold the in-network form, and replacing
  // one of those photos must still delete the old file rather than orphan it.
  test("still reads an id from a legacy in-network URL", () => {
    process.env.STORAGE_URL = INTERNAL;
    process.env.STORAGE_PUBLIC_URL = PUBLIC;
    expect(parseMediaId(`${INTERNAL}/files/abc-123/medium`)).toBe("abc-123");
  });

  test("falls back to STORAGE_URL when no public origin is set (local dev)", () => {
    process.env.STORAGE_URL = "http://localhost:3100";
    delete process.env.STORAGE_PUBLIC_URL;
    expect(parseMediaId("http://localhost:3100/files/xyz/original")).toBe("xyz");
  });

  test("ignores a trailing slash on either origin", () => {
    process.env.STORAGE_URL = `${INTERNAL}/`;
    process.env.STORAGE_PUBLIC_URL = `${PUBLIC}/`;
    expect(parseMediaId(`${PUBLIC}/files/abc-123/medium`)).toBe("abc-123");
  });

  test("returns null for URLs this service did not issue", () => {
    process.env.STORAGE_URL = INTERNAL;
    process.env.STORAGE_PUBLIC_URL = PUBLIC;
    expect(parseMediaId("https://youtube.com/watch?v=abc")).toBeNull();
    expect(parseMediaId("")).toBeNull();
    // Right origin, but not a /files/ path.
    expect(parseMediaId(`${PUBLIC}/media/abc-123`)).toBeNull();
    // /files/ with no id after it.
    expect(parseMediaId(`${PUBLIC}/files/`)).toBeNull();
  });
});
