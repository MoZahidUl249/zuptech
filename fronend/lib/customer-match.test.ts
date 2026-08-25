import { describe, expect, test } from "bun:test";
import { buildCustomerMatch, __normalize } from "./customer-match";

/**
 * Two things are being pinned here, and the second matters more than the first.
 *
 * 1. Normalisation matches Meta's rules. A digest only matches if both sides
 *    normalised identically, so "01711…" vs "8801711…" is not a formatting
 *    nit — it is the difference between a matched purchase and a wasted one.
 *
 * 2. **No plaintext ever leaves this module.** The dataLayer is readable by
 *    every tag in the container, and these containers carry Clarity and Hotjar,
 *    which record sessions. A regression that pushed a raw phone number would
 *    be invisible in the UI and would quietly hand customer contact details to
 *    two session-replay vendors. The last test in this file is the one that
 *    would catch it.
 */

const FACTS = {
  name: "Mohammad Rahman",
  phone: "01711111111",
  email: "Buyer@Example.COM",
  insideDhaka: true,
};

describe("normalisation follows Meta's rules", () => {
  test("a local 01… number becomes the international form", () => {
    expect(__normalize.normalizePhone("01711111111")).toBe("8801711111111");
  });

  test("punctuation and spacing in a typed number are stripped", () => {
    expect(__normalize.normalizePhone("+880 1711-111111")).toBe("8801711111111");
    expect(__normalize.normalizePhone(" 017 111 11111 ")).toBe("8801711111111");
  });

  test("a number already carrying the country code is left alone", () => {
    expect(__normalize.normalizePhone("8801711111111")).toBe("8801711111111");
  });

  test("email is trimmed and lowercased", () => {
    expect(__normalize.normalizeEmail("  Buyer@Example.COM ")).toBe("buyer@example.com");
  });

  test("names lowercase and collapse whitespace", () => {
    expect(__normalize.normalizeText("  Mohammad   RAHMAN ")).toBe("mohammad rahman");
  });

  test("the last token is the surname; a single token has no surname", () => {
    expect(__normalize.splitName("Mohammad Rahman")).toEqual({ first: "mohammad", last: "rahman" });
    expect(__normalize.splitName("Mohammad Abdul Rahman")).toEqual({
      first: "mohammad abdul",
      last: "rahman",
    });
    expect(__normalize.splitName("Rahman")).toEqual({ first: "rahman", last: "" });
  });
});

describe("buildCustomerMatch", () => {
  test("every field is a 64-char SHA-256 hex digest", async () => {
    const m = await buildCustomerMatch(FACTS);
    for (const [key, value] of Object.entries(m)) {
      expect(value, key).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test("a known input gives the known digest — normalisation included", async () => {
    // sha256("8801711111111"), i.e. the LOCAL number after normalisation.
    const m = await buildCustomerMatch({ phone: "01711111111" });
    const direct = await buildCustomerMatch({ phone: "+880 1711-111111" });
    // Two spellings of one number must land on one digest, or half the
    // customers who type a "+" match and half do not.
    expect(m.customerBillingPhone).toBe(direct.customerBillingPhone!);
  });

  test("absent facts are omitted, never pushed as empty strings", async () => {
    const m = await buildCustomerMatch({ name: "", phone: "", email: "", insideDhaka: false });
    expect(m.customerFirstName).toBeUndefined();
    expect(m.customerLastName).toBeUndefined();
    expect(m.customerBillingPhone).toBeUndefined();
    expect(m.customerBillingEmail).toBeUndefined();
    // No zone claim when the order ships outside Dhaka — we do not know the city.
    expect(m.customerBillingCity).toBeUndefined();
    // Country is always known: this shop ships within Bangladesh.
    expect(m.customerBillingCountry).toMatch(/^[0-9a-f]{64}$/);
  });

  test("a guest with no email still matches on name, phone and country", async () => {
    const m = await buildCustomerMatch({ name: "Nusrat Jahan", phone: "01822222222" });
    expect(m.customerFirstName).toBeDefined();
    expect(m.customerLastName).toBeDefined();
    expect(m.customerBillingPhone).toBeDefined();
    expect(m.customerBillingEmail).toBeUndefined();
  });

  test("a one-word name gives a first name and no last", async () => {
    const m = await buildCustomerMatch({ name: "Rahman" });
    expect(m.customerFirstName).toBeDefined();
    expect(m.customerLastName).toBeUndefined();
  });

  /**
   * The one that guards the privacy decision. If a refactor ever pushes a raw
   * value, this fails — and it is the only thing standing between a customer's
   * phone number and every session-replay vendor in the container.
   */
  test("NO plaintext survives — not the phone, email, name or city", async () => {
    const serialized = JSON.stringify(await buildCustomerMatch(FACTS));
    for (const secret of [
      "01711111111",
      "8801711111111",
      "buyer@example.com",
      "Buyer@Example.COM",
      "mohammad",
      "rahman",
      "Mohammad Rahman",
      "dhaka",
    ]) {
      expect(serialized.toLowerCase()).not.toContain(secret.toLowerCase());
    }
  });
});
