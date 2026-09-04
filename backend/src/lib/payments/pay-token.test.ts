import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { payTokenMatches, signPayToken } from "./pay-token";

/**
 * The proof that a caller placed the order they are trying to pay for.
 *
 * Order ids are sequential and printed on invoices, so this is the only thing
 * standing between `POST /api/orders/:id/pay` and someone walking the range,
 * opening gateway sessions against strangers' orders and pushing their name,
 * phone and address to EPS.
 */

const REAL_SECRET = process.env.BETTER_AUTH_SECRET;

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret-for-pay-tokens";
});

afterAll(() => {
  if (REAL_SECRET === undefined) delete process.env.BETTER_AUTH_SECRET;
  else process.env.BETTER_AUTH_SECRET = REAL_SECRET;
});

describe("signPayToken", () => {
  test("is stable for an order, so a refresh does not invalidate it", () => {
    expect(signPayToken("ZT-10241")).toBe(signPayToken("ZT-10241"));
  });

  test("differs per order — the whole point", () => {
    // Sequential ids mean a token that worked for one order must be useless
    // for the next one along.
    expect(signPayToken("ZT-10241")).not.toBe(signPayToken("ZT-10242"));
  });

  test("does not contain the order id it signs", () => {
    expect(signPayToken("ZT-10241")).not.toContain("10241");
  });

  test("refuses to sign without a secret rather than falling back to one", () => {
    const saved = process.env.BETTER_AUTH_SECRET;
    delete process.env.BETTER_AUTH_SECRET;
    // A constant fallback would make every token forgeable by anyone who has
    // read the source.
    expect(() => signPayToken("ZT-10241")).toThrow(/BETTER_AUTH_SECRET/);
    process.env.BETTER_AUTH_SECRET = saved;
  });
});

describe("payTokenMatches", () => {
  test("accepts the order's own token", () => {
    expect(payTokenMatches("ZT-10241", signPayToken("ZT-10241"))).toBe(true);
  });

  test("rejects another order's token", () => {
    expect(payTokenMatches("ZT-10242", signPayToken("ZT-10241"))).toBe(false);
  });

  test("rejects nothing, empty and rubbish", () => {
    expect(payTokenMatches("ZT-10241", undefined)).toBe(false);
    expect(payTokenMatches("ZT-10241", "")).toBe(false);
    expect(payTokenMatches("ZT-10241", "not-a-token")).toBe(false);
  });

  test("a token signed under a different secret is refused", () => {
    const foreign = signPayToken("ZT-10241");
    process.env.BETTER_AUTH_SECRET = "a-different-secret";

    expect(payTokenMatches("ZT-10241", foreign)).toBe(false);

    process.env.BETTER_AUTH_SECRET = "test-secret-for-pay-tokens";
  });

  test("a wrong token of any length is refused without throwing", () => {
    // Both sides are hashed before comparison precisely so a length mismatch
    // cannot throw — which would itself leak the token's length.
    for (const attempt of ["a", "a".repeat(500), signPayToken("x").slice(0, 10)]) {
      expect(payTokenMatches("ZT-10241", attempt)).toBe(false);
    }
  });
});
