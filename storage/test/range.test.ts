import { describe, expect, test } from "bun:test";
import { parseRangeHeader } from "../src/lib/range";

describe("parseRangeHeader", () => {
  const FILE_SIZE = 1000;

  test("returns null when no range header", () => {
    expect(parseRangeHeader(null, FILE_SIZE)).toBeNull();
  });

  test("returns null when header doesn't start with bytes=", () => {
    expect(parseRangeHeader("items=0-10", FILE_SIZE)).toBeNull();
  });

  test("parses a simple bounded range", () => {
    expect(parseRangeHeader("bytes=0-499", FILE_SIZE)).toEqual({ start: 0, end: 499 });
  });

  test("parses an open-ended range (to EOF)", () => {
    expect(parseRangeHeader("bytes=500-", FILE_SIZE)).toEqual({ start: 500, end: 999 });
  });

  test("parses a suffix range (last N bytes)", () => {
    expect(parseRangeHeader("bytes=-500", FILE_SIZE)).toEqual({ start: 500, end: 999 });
  });

  test("suffix range larger than file clamps to start of file", () => {
    expect(parseRangeHeader("bytes=-5000", FILE_SIZE)).toEqual({ start: 0, end: 999 });
  });

  test("clamps end beyond file size to last byte", () => {
    expect(parseRangeHeader("bytes=900-999999", FILE_SIZE)).toEqual({ start: 900, end: 999 });
  });

  test("only honors the first range in a multi-range request", () => {
    expect(parseRangeHeader("bytes=0-99,200-299", FILE_SIZE)).toEqual({ start: 0, end: 99 });
  });

  test("returns undefined (unsatisfiable) when start >= fileSize", () => {
    expect(parseRangeHeader("bytes=1000-1100", FILE_SIZE)).toBeUndefined();
  });

  test("returns undefined when start > end", () => {
    expect(parseRangeHeader("bytes=500-100", FILE_SIZE)).toBeUndefined();
  });

  test("returns undefined for a negative suffix length", () => {
    expect(parseRangeHeader("bytes=-0", FILE_SIZE)).toBeUndefined();
  });

  test("returns undefined for garbage input", () => {
    expect(parseRangeHeader("bytes=abc-def", FILE_SIZE)).toBeUndefined();
  });

  test("returns undefined when there's no dash at all", () => {
    expect(parseRangeHeader("bytes=500", FILE_SIZE)).toBeUndefined();
  });
});
