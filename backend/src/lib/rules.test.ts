import { describe, expect, test } from "bun:test";
import {
  availableStock,
  bestQuantityOffer,
  LEAD_STATUSES,
  MAX_SVG_LOGO_BYTES,
  effectiveUnitPrice,
  GTM_ID_RE,
  isDeliveryFree,
  isLowStock,
  isMaskedSecret,
  isOneOf,
  isValidPhone,
  maskSecret,
  minDownPayment,
  normalizePhone,
  ORDER_STATUSES,
  parseOrderStatus,
  reorderQty,
  salePrice,
  sanitizeSvgLogo,
} from "./rules";

describe("phone", () => {
  test("normalizes spaces and dashes", () => {
    expect(normalizePhone("01712-345 678")).toBe("01712345678");
  });
  test("accepts valid BD mobiles", () => {
    expect(isValidPhone("01712345678")).toBe(true);
    expect(isValidPhone("01712-345678")).toBe(true);
  });
  test("rejects wrong prefix/length", () => {
    expect(isValidPhone("8801712345678")).toBe(false);
    expect(isValidPhone("0171234567")).toBe(false);
    expect(isValidPhone("02123456789")).toBe(false);
  });
});

describe("stock", () => {
  test("available = stock − reserved, floored at 0", () => {
    expect(availableStock({ stock: 10, reserved: 3, reorderAt: 5 })).toBe(7);
    expect(availableStock({ stock: 2, reserved: 5, reorderAt: 5 })).toBe(0);
  });
  test("low stock only when 0 < stock ≤ reorderAt", () => {
    expect(isLowStock({ stock: 3, reserved: 0, reorderAt: 5 })).toBe(true);
    expect(isLowStock({ stock: 0, reserved: 0, reorderAt: 5 })).toBe(false);
    expect(isLowStock({ stock: 6, reserved: 0, reorderAt: 5 })).toBe(false);
  });
  test("reorder qty = max(reorderAt×2 − stock, reorderAt)", () => {
    expect(reorderQty({ stock: 2, reserved: 0, reorderAt: 5 })).toBe(8);
    expect(reorderQty({ stock: 20, reserved: 0, reorderAt: 5 })).toBe(5);
  });
});

describe("misc", () => {
  test("GTM id pattern", () => {
    expect(GTM_ID_RE.test("GTM-ABC1234")).toBe(true);
    expect(GTM_ID_RE.test("GTM-ab")).toBe(false);
  });
  test("min down payment rounds up", () => {
    expect(minDownPayment(42500, 20)).toBe(8500);
    expect(minDownPayment(1650, 10)).toBe(165);
    expect(minDownPayment(999, 33)).toBe(330); // 329.67 → 330
  });
  test("sale price discounts only when onSale is true", () => {
    expect(salePrice({ price: 1000, onSale: false, salePercentage: 50 })).toBe(1000);
    expect(salePrice({ price: 1000, onSale: true, salePercentage: 0 })).toBe(1000);
    expect(salePrice({ price: 1000, onSale: true, salePercentage: 20 })).toBe(800);
    expect(salePrice({ price: 999, onSale: true, salePercentage: 33 })).toBe(670); // 329.67 → floor 329
    expect(salePrice({ price: 1000, onSale: true, salePercentage: 100 })).toBe(0);
  });
  test("bestQuantityOffer picks the highest threshold the qty satisfies", () => {
    const offers = [
      { minQty: 3, percentage: 5 },
      { minQty: 5, percentage: 10 },
      { minQty: 10, percentage: 15 },
    ];
    expect(bestQuantityOffer(offers, 1)).toBeNull();
    expect(bestQuantityOffer(offers, 2)).toBeNull();
    expect(bestQuantityOffer(offers, 3)).toEqual({ minQty: 3, percentage: 5 });
    expect(bestQuantityOffer(offers, 4)).toEqual({ minQty: 3, percentage: 5 });
    expect(bestQuantityOffer(offers, 5)).toEqual({ minQty: 5, percentage: 10 });
    expect(bestQuantityOffer(offers, 12)).toEqual({ minQty: 10, percentage: 15 });
    expect(bestQuantityOffer([], 10)).toBeNull();
  });
  test("effectiveUnitPrice charges whichever discount is cheaper, never both", () => {
    const offers = [{ minQty: 3, percentage: 5 }];
    // No offers apply below the threshold — falls back to the flat sale price.
    expect(
      effectiveUnitPrice({ price: 1000, onSale: false, salePercentage: 0 }, 2, offers),
    ).toBe(1000);
    // Qty tier applies and there's no sale — qty price wins.
    expect(
      effectiveUnitPrice({ price: 1000, onSale: false, salePercentage: 0 }, 3, offers),
    ).toBe(950);
    // Sale (20%) beats the qty tier (5%) — cheaper price wins.
    expect(
      effectiveUnitPrice({ price: 1000, onSale: true, salePercentage: 20 }, 3, offers),
    ).toBe(800);
    // Qty tier (5%) beats a smaller sale (2%) — cheaper price wins.
    expect(
      effectiveUnitPrice({ price: 1000, onSale: true, salePercentage: 2 }, 3, offers),
    ).toBe(950);
  });
  test("isDeliveryFree only unlocks at/above a positive threshold", () => {
    expect(isDeliveryFree({ freeDeliveryMinQty: 0 }, 10)).toBe(false); // disabled
    expect(isDeliveryFree({ freeDeliveryMinQty: 4 }, 3)).toBe(false);
    expect(isDeliveryFree({ freeDeliveryMinQty: 4 }, 4)).toBe(true);
    expect(isDeliveryFree({ freeDeliveryMinQty: 4 }, 5)).toBe(true);
  });
  test("secrets are masked to last 4", () => {
    expect(maskSecret("bk_live_7f31a92c44e8")).toBe("••••44e8");
    expect(maskSecret("")).toBe("");
  });
  test("a mask we sent is recognized as unchanged", () => {
    expect(isMaskedSecret(maskSecret("bk_live_7f31a92c44e8"))).toBe(true);
    expect(isMaskedSecret("bk_live_new_secret")).toBe(false);
  });
});

describe("svg logo sanitizer", () => {
  const plain = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#0B4FE0"/></svg>';

  test("accepts inert drawing markup", () => {
    expect(sanitizeSvgLogo(plain)).toBe(plain);
  });
  test("strips the XML prolog and comments editors leave behind", () => {
    expect(sanitizeSvgLogo(`<?xml version="1.0"?><!-- Generator --> ${plain}`)).toBe(plain);
  });
  test("empty input clears the logo", () => {
    expect(sanitizeSvgLogo("")).toBe("");
    expect(sanitizeSvgLogo("   ")).toBe("");
  });
  test("requires a single <svg> root", () => {
    expect(() => sanitizeSvgLogo("<div>nope</div>")).toThrow(/single <svg> element/);
    expect(() => sanitizeSvgLogo(`${plain}<img src=x>`)).toThrow(/single <svg> element/);
  });

  // Each of these would execute in the storefront, which renders the markup
  // inline — they must be refused, not quietly stored.
  test.each([
    ['<svg><script>alert(1)</script></svg>', /script/i],
    ['<svg onload="alert(1)"></svg>', /event handler/i],
    ['<svg><circle onclick="alert(1)"/></svg>', /event handler/i],
    ['<svg><a href="javascript:alert(1)"><circle/></a></svg>', /script\/data URLs/i],
    ['<svg><image xlink:href="data:text/html;base64,PHNjcmlwdD4="/></svg>', /script\/data URLs/i],
    ['<svg><foreignObject><body/></foreignObject></svg>', /foreignObject/i],
    ['<svg><style>@import url(//evil.test/x.css)</style></svg>', /style/i],
    ['<svg><use href="https://evil.test/x.svg#a"/></svg>', /external references/i],
    ['<!DOCTYPE svg [<!ENTITY x "y">]><svg></svg>', /DOCTYPE\/ENTITY/i],
  ])("rejects %s", (markup, reason) => {
    expect(() => sanitizeSvgLogo(markup)).toThrow(reason);
  });

  test("rejects markup over the size cap", () => {
    const huge = `<svg>${"<circle/>".repeat(MAX_SVG_LOGO_BYTES)}</svg>`;
    expect(() => sanitizeSvgLogo(huge)).toThrow(/under \d+KB/);
  });
});

describe("vocabularies", () => {
  test("isOneOf narrows free strings against const arrays", () => {
    expect(isOneOf(ORDER_STATUSES, "On the way")).toBe(true);
    expect(isOneOf(ORDER_STATUSES, "on the way")).toBe(false);
    expect(isOneOf(LEAD_STATUSES, "Survey booked")).toBe(true);
    expect(isOneOf(LEAD_STATUSES, "Archived")).toBe(false);
  });
  test("parseOrderStatus accepts every stored status", () => {
    for (const status of ORDER_STATUSES) {
      expect(parseOrderStatus(status)).toBe(status);
    }
  });
  test("parseOrderStatus throws on corrupt data instead of passing it on", () => {
    expect(() => parseOrderStatus("Shipped")).toThrow(/Unknown order status/);
    expect(() => parseOrderStatus("")).toThrow(/Unknown order status/);
  });
});
