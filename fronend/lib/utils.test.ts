import { describe, expect, test } from "bun:test";
import { numberInput, slugChars, slugify, whole } from "./utils";

/*
 * Both functions here exist to keep the admin's inputs inside what the API's
 * DTOs accept. The API answers a violation with a 422 carrying a schema dump,
 * which the operator cannot act on — so the tests below are about what the
 * server would have rejected, not about formatting.
 */

describe("numberInput — what a field holds while it is typed", () => {
  test("does NOT round, so the decimal point survives the keystroke", () => {
    // Rounding here re-renders "1250." as "1250"; the operator's remaining
    // "5" and "0" then land as digits and ৳1,250.50 is saved as ৳12,510.
    expect(numberInput("1250.50")).toBe(1250.5);
    expect(numberInput("1250.")).toBe(1250);
  });

  test("a half-typed value reads as the floor, never NaN", () => {
    expect(numberInput("")).toBe(0);
    expect(numberInput("abc")).toBe(0);
    expect(numberInput("-", { min: 1 })).toBe(1);
  });

  test("still clamps to the field's range", () => {
    expect(numberInput("-40")).toBe(0);
    expect(numberInput("999", { max: 240 })).toBe(240);
  });
});

describe("whole — what the request body carries", () => {
  test("rounds a fractional amount the API would reject", () => {
    // A price typed with poysha. This reached POST /admin/api/products as
    // 1250.5 and came back 422, which read as "saving is broken".
    expect(whole("1250.50")).toBe(1251);
    expect(whole(1250.5)).toBe(1251);
    expect(whole("1250.49")).toBe(1250);
  });

  test("a half-typed or nonsense value reads as the floor, never NaN", () => {
    expect(whole("")).toBe(0);
    expect(whole("abc")).toBe(0);
    expect(whole("-")).toBe(0);
    expect(whole("", { min: 1 })).toBe(1);
  });

  test("clamps to the field's own range", () => {
    expect(whole("-40")).toBe(0);
    expect(whole("999", { max: 240 })).toBe(240);
    expect(whole("0", { min: 1 })).toBe(1);
  });

  test("leaves a value that was already whole alone", () => {
    expect(whole("42")).toBe(42);
    expect(whole("0")).toBe(0);
  });
});

describe("slugChars — the slug field as it is typed", () => {
  test("folds anything the API's ^[a-z0-9-]+$ would reject", () => {
    expect(slugChars("Solar Panel")).toBe("solar-panel");
    expect(slugChars("QA Test Widget 01")).toBe("qa-test-widget-01");
    expect(slugChars("AC_Unit")).toBe("ac-unit");
  });

  test("keeps the trailing hyphen, so a space mid-name still separates words", () => {
    // slugify strips it, which ran the words together on the next keystroke.
    expect(slugChars("solar ")).toBe("solar-");
    expect(slugify("solar ")).toBe("solar");
  });
});
