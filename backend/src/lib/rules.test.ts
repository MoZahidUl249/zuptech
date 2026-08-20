import { describe, expect, test } from "bun:test";
import {
  availableStock,
  bestCampaignTier,
  bestQuantityOffer,
  campaignUnitPrice,
  LEAD_STATUSES,
  MAX_SVG_LOGO_BYTES,
  deliveryDiscountAmount,
  discountedDeliveryFee,
  duplicateMinQtys,
  effectiveUnitPrice,
  GTM_ID_RE,
  isLowStock,
  salePriceFrom,
  stockTagFor,
  isMaskedSecret,
  secretsMatch,
  isOneOf,
  isValidPhone,
  maskSecret,
  normalizePhone,
  ORDER_STATUSES,
  parseOrderStatus,
  reorderQty,
  sellingPrice,
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
  test("sellingPrice uses the sale price only when it is a real discount", () => {
    expect(sellingPrice({ price: 1000, onSale: false, salePrice: 800 })).toBe(1000);
    // 0 means "not set", not "free" — otherwise a blank field gives it away.
    expect(sellingPrice({ price: 1000, onSale: true, salePrice: 0 })).toBe(1000);
    expect(sellingPrice({ price: 1000, onSale: true, salePrice: 800 })).toBe(800);
    // A sale price above list is a typo, not a markup — ignore it.
    expect(sellingPrice({ price: 1000, onSale: true, salePrice: 1200 })).toBe(1000);
    expect(sellingPrice({ price: 1000, onSale: true, salePrice: 1 })).toBe(1);
  });
  test("bestQuantityOffer picks the highest threshold the qty satisfies", () => {
    const offers = [
      { minQty: 3, amount: 50 },
      { minQty: 5, amount: 100 },
      { minQty: 10, amount: 150 },
    ];
    expect(bestQuantityOffer(offers, 1)).toBeNull();
    expect(bestQuantityOffer(offers, 2)).toBeNull();
    expect(bestQuantityOffer(offers, 3)).toEqual({ minQty: 3, amount: 50 });
    expect(bestQuantityOffer(offers, 4)).toEqual({ minQty: 3, amount: 50 });
    expect(bestQuantityOffer(offers, 5)).toEqual({ minQty: 5, amount: 100 });
    expect(bestQuantityOffer(offers, 12)).toEqual({ minQty: 10, amount: 150 });
    expect(bestQuantityOffer([], 10)).toBeNull();
  });
  test("effectiveUnitPrice charges whichever discount is cheaper, never both", () => {
    const offers = [{ minQty: 3, amount: 50 }];
    // No offers apply below the threshold — falls back to the sale price.
    expect(effectiveUnitPrice({ price: 1000, onSale: false, salePrice: 0 }, 2, offers)).toBe(1000);
    // Qty tier applies and there's no sale — qty price wins.
    expect(effectiveUnitPrice({ price: 1000, onSale: false, salePrice: 0 }, 3, offers)).toBe(950);
    // Sale (৳800) beats the qty tier (৳950) — cheaper price wins.
    expect(effectiveUnitPrice({ price: 1000, onSale: true, salePrice: 800 }, 3, offers)).toBe(800);
    // Qty tier (৳950) beats a shallower sale (৳980) — cheaper price wins.
    expect(effectiveUnitPrice({ price: 1000, onSale: true, salePrice: 980 }, 3, offers)).toBe(950);
  });
  test("effectiveUnitPrice floors at zero when a tier exceeds the price", () => {
    // An over-generous tier gives the unit away; it must never invert the line.
    expect(
      effectiveUnitPrice({ price: 500, onSale: false, salePrice: 0 }, 5, [
        { minQty: 2, amount: 900 },
      ]),
    ).toBe(0);
  });
  test("deliveryDiscountAmount picks the highest tier the qty satisfies", () => {
    const tiers = [
      { minQty: 2, amount: 150 },
      { minQty: 5, amount: 300 },
    ];
    expect(deliveryDiscountAmount([], 10)).toBe(0); // no ladder = full fee
    expect(deliveryDiscountAmount(tiers, 1)).toBe(0);
    expect(deliveryDiscountAmount(tiers, 2)).toBe(150);
    expect(deliveryDiscountAmount(tiers, 4)).toBe(150); // between tiers, lower wins
    expect(deliveryDiscountAmount(tiers, 5)).toBe(300);
    expect(deliveryDiscountAmount(tiers, 50)).toBe(300); // above the top tier
  });
  test("discountedDeliveryFee subtracts the best tier and clamps at zero", () => {
    const tiers = [
      { minQty: 2, amount: 150 },
      { minQty: 5, amount: 300 },
    ];
    expect(discountedDeliveryFee(300, tiers, 1)).toBe(300);
    expect(discountedDeliveryFee(300, tiers, 2)).toBe(150);
    expect(discountedDeliveryFee(300, tiers, 5)).toBe(0); // amount == fee: free
    expect(discountedDeliveryFee(300, [], 99)).toBe(300);
    // An amount above the fee is how "free delivery" is expressed for the
    // cheaper zone — it must not hand money back.
    expect(discountedDeliveryFee(150, tiers, 5)).toBe(0);
    // A zero zone fee stays zero rather than going negative.
    expect(discountedDeliveryFee(0, tiers, 10)).toBe(0);
  });
  test("secrets are masked to last 4", () => {
    expect(maskSecret("bk_live_7f31a92c44e8")).toBe("••••44e8");
    expect(maskSecret("")).toBe("");
  });
  test("a mask we sent is recognized as unchanged", () => {
    expect(isMaskedSecret(maskSecret("bk_live_7f31a92c44e8"))).toBe(true);
    expect(isMaskedSecret("bk_live_new_secret")).toBe(false);
  });

  test("secretsMatch accepts only the exact secret", () => {
    const secret = "bk_live_7f31a92c44e8";
    expect(secretsMatch(secret, secret)).toBe(true);
    expect(secretsMatch("bk_live_7f31a92c44e9", secret)).toBe(false);
    // A correct prefix must not pass — that is the whole attack the constant-
    // time comparison exists to stop.
    expect(secretsMatch("bk_live_7f31a92c44e", secret)).toBe(false);
    expect(secretsMatch(secret + "x", secret)).toBe(false);
  });

  test("secretsMatch never treats a missing secret as a match", () => {
    // An unconfigured provider must not be open to a caller who also sends
    // nothing — two empty values are not credentials.
    expect(secretsMatch(undefined, "stored")).toBe(false);
    expect(secretsMatch("supplied", undefined)).toBe(false);
    expect(secretsMatch(undefined, undefined)).toBe(false);
    expect(secretsMatch("", "")).toBe(false);
  });
});

describe("svg logo sanitizer", () => {
  const plain = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#0B4FE0"/></svg>';
  // What comes back is re-serialized from the parse tree, not the input
  // string — self-closing tags expand, which is what the browser does anyway.
  const plainOut = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#0B4FE0"></circle></svg>';

  test("accepts inert drawing markup", () => {
    expect(sanitizeSvgLogo(plain)).toBe(plainOut);
  });
  test("strips the XML prolog and comments editors leave behind", () => {
    expect(sanitizeSvgLogo(`<?xml version="1.0"?><!-- Generator --> ${plain}`)).toBe(plainOut);
  });
  test("keeps the camelCase SVG spellings a logo needs", () => {
    const gradient =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">' +
      '<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"></stop></linearGradient></defs>' +
      '<rect width="40" height="40" fill="url(#g)"></rect></svg>';
    expect(sanitizeSvgLogo(gradient)).toBe(gradient);
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
    ['<svg><a href="javascript:alert(1)"><circle/></a></svg>', /not allowed/i],
    ['<svg><image xlink:href="data:text/html;base64,PHNjcmlwdD4="/></svg>', /not allowed/i],
    ['<svg><foreignObject><body/></foreignObject></svg>', /foreignobject/i],
    ['<svg><style>@import url(//evil.test/x.css)</style></svg>', /style/i],
    ['<svg><use href="https://evil.test/x.svg#a"/></svg>', /external reference/i],
    ['<!DOCTYPE svg [<!ENTITY x "y">]><svg></svg>', /DOCTYPE\/ENTITY/i],
    // Regressions. Every one of these was ACCEPTED by the regex blocklist this
    // sanitizer replaced: an HTML parser takes `/` and a closing quote as
    // attribute separators, and decodes entities before reading the scheme.
    ['<svg><rect/onmouseover=alert(1) width="9"/></svg>', /event handler/i],
    ['<svg><rect id="a"onmouseover=alert(1) width="9"/></svg>', /event handler/i],
    ['<svg><circle/onfocus=alert(1) tabindex=0 r="5"/></svg>', /event handler/i],
    ['<svg><a xlink:href="&#106;avascript:alert(1)"><circle r="9"/></a></svg>', /not allowed/i],
    // CSS can't execute, but it can lift an element over the whole page.
    ['<svg><rect style="position:fixed;inset:0;width:100vw"/></svg>', /"style" attribute/i],
    ['<svg><animate attributeName="x" onbegin="alert(1)"/></svg>', /not allowed/i],
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

describe("salePriceFrom — the one place a percentage becomes money", () => {
  test("resolves a percentage to taka, rounding once", () => {
    expect(salePriceFrom(42500, 10)).toBe(38250);
    expect(salePriceFrom(1000, 25)).toBe(750);
    // 999 at 33% is 669.33 — the case in the schema comment, where three
    // separate roundings once produced a display of 669 against a charge of
    // 670. One call site, one answer.
    expect(salePriceFrom(999, 33)).toBe(669);
  });
  test("0% means no sale, not a free product", () => {
    expect(salePriceFrom(1000, 0)).toBe(0);
  });
  test("100% is allowed and floors at zero", () => {
    expect(salePriceFrom(1000, 100)).toBe(0);
  });
  test("clamps nonsense rather than computing a negative price", () => {
    expect(salePriceFrom(1000, 140)).toBe(0);
    expect(salePriceFrom(1000, -20)).toBe(0);
  });
  test("a backfilled percentage does NOT reproduce an unclean sale price", () => {
    /*
     * The reason the admin PATCH compares against the stored row rather than
     * recomputing whenever the fields are present.
     *
     * Migration 20260813180000 backfills a whole percentage from an existing
     * sale price and deliberately leaves that price alone. Where the original
     * was not a clean percentage the two do not agree, so recomputing on an
     * unrelated save silently reprices the product — measured at 777 -> 780 on
     * a running stack before the fix.
     */
    const price = 1000;
    const storedSalePrice = 777;
    const backfilledPct = Math.round(((price - storedSalePrice) * 100) / price); // 22
    expect(backfilledPct).toBe(22);
    expect(salePriceFrom(price, backfilledPct)).toBe(780);
    expect(salePriceFrom(price, backfilledPct)).not.toBe(storedSalePrice);
  });
  test("round-trips the values the migration backfills", () => {
    // The backfill derives a percentage from an existing sale price; feeding
    // it back must reproduce that price, or deploying the migration would
    // silently reprice the catalogue on the next admin save.
    for (const [price, sale] of [[42500, 38250], [999, 669], [55000, 41250]] as const) {
      const pct = Math.round(((price - sale) * 100) / price);
      expect(salePriceFrom(price, pct)).toBe(sale);
    }
  });
});

describe("stockTagFor", () => {
  const inStock = { stock: 5, reserved: 0, reorderAt: 2, stockTag: "" };
  const empty = { stock: 0, reserved: 0, reorderAt: 2, stockTag: "" };
  const allReserved = { stock: 3, reserved: 3, reorderAt: 2, stockTag: "" };

  test("shows nothing while there is stock to sell", () => {
    expect(stockTagFor(inStock, false)).toBe("");
    expect(stockTagFor(inStock, true)).toBe("");
  });
  test("out of stock when nothing is available and nothing is coming", () => {
    expect(stockTagFor(empty, false)).toBe("Out of stock");
    // Reserved units are spoken for — available, not on-hand, is the question.
    expect(stockTagFor(allReserved, false)).toBe("Out of stock");
  });
  test("incoming when nothing is available but a purchase order is in transit", () => {
    expect(stockTagFor(empty, true)).toBe("Incoming");
  });
  test("a manual tag overrides the derivation entirely", () => {
    expect(stockTagFor({ ...inStock, stockTag: "Sold out" }, false)).toBe("Sold out");
    expect(stockTagFor({ ...empty, stockTag: "Incoming" }, false)).toBe("Incoming");
    // Including overriding back to a plainer label than the data suggests.
    expect(stockTagFor({ ...empty, stockTag: "Sold out" }, true)).toBe("Sold out");
  });
});

describe("campaignUnitPrice", () => {
  /* The live shape that motivated the whole table: listed 2600, on sale at
     2184, so anything the product ladder could express below ৳417 off was
     already worthless. */
  const shop = { price: 2600, onSale: true, salePrice: 2184 };

  test("with no campaign tiers it IS effectiveUnitPrice", () => {
    for (const qty of [1, 2, 3, 10]) {
      expect(campaignUnitPrice(shop, qty, [], [])).toBe(effectiveUnitPrice(shop, qty, []));
    }
    // …including when the product has a ladder of its own — the fallback must
    // not quietly drop the product's own tiers.
    const offers = [{ minQty: 3, amount: 600 }];
    expect(campaignUnitPrice(shop, 3, offers, [])).toBe(effectiveUnitPrice(shop, 3, offers));
  });

  test("a qualifying tier charges its absolute price, whatever the sale is", () => {
    const tiers = [{ minQty: 2, unitPrice: 2000 }];
    expect(campaignUnitPrice(shop, 1, [], tiers)).toBe(2184); // below the threshold
    expect(campaignUnitPrice(shop, 2, [], tiers)).toBe(2000);
    expect(campaignUnitPrice(shop, 9, [], tiers)).toBe(2000); // and above it
  });

  test("the highest qualifying tier wins, never the sum", () => {
    const tiers = [
      { minQty: 2, unitPrice: 2000 },
      { minQty: 3, unitPrice: 1900 },
    ];
    expect(campaignUnitPrice(shop, 2, [], tiers)).toBe(2000);
    expect(campaignUnitPrice(shop, 3, [], tiers)).toBe(1900);
  });

  test("a minQty:1 tier prices a single unit", () => {
    expect(campaignUnitPrice(shop, 1, [], [{ minQty: 1, unitPrice: 2100 }])).toBe(2100);
  });

  test("a tier at or above the shop price is inert — an ad never costs more", () => {
    // Mistyped, or written before the sale deepened. Either way the customer
    // pays what the shop charges, not what the campaign asked for.
    expect(campaignUnitPrice(shop, 2, [], [{ minQty: 2, unitPrice: 2500 }])).toBe(2184);
    expect(campaignUnitPrice(shop, 2, [], [{ minQty: 2, unitPrice: 2184 }])).toBe(2184);
  });

  test("it beats a product tier that would otherwise have won", () => {
    const offers = [{ minQty: 2, amount: 700 }]; // → 1900
    const tiers = [{ minQty: 2, unitPrice: 1800 }];
    expect(campaignUnitPrice(shop, 2, offers, tiers)).toBe(1800);
    // …but not the other way round: the cheaper of the two always wins.
    expect(campaignUnitPrice(shop, 2, offers, [{ minQty: 2, unitPrice: 1950 }])).toBe(1900);
  });

  test("never negative, however generous the tier", () => {
    expect(campaignUnitPrice(shop, 2, [], [{ minQty: 2, unitPrice: 0 }])).toBe(0);
  });
});

describe("bestCampaignTier", () => {
  const tiers = [
    { minQty: 2, unitPrice: 2000 },
    { minQty: 5, unitPrice: 1800 },
  ];
  test("picks the highest threshold the qty satisfies", () => {
    expect(bestCampaignTier(tiers, 1)).toBeNull();
    expect(bestCampaignTier(tiers, 2)).toEqual({ minQty: 2, unitPrice: 2000 });
    expect(bestCampaignTier(tiers, 4)).toEqual({ minQty: 2, unitPrice: 2000 });
    expect(bestCampaignTier(tiers, 5)).toEqual({ minQty: 5, unitPrice: 1800 });
    expect(bestCampaignTier([], 9)).toBeNull();
  });
});

describe("duplicateMinQtys", () => {
  test("names every repeated threshold, once each", () => {
    expect(duplicateMinQtys([{ minQty: 2 }, { minQty: 3 }])).toEqual([]);
    expect(duplicateMinQtys([{ minQty: 2 }, { minQty: 2 }])).toEqual([2]);
    expect(duplicateMinQtys([{ minQty: 2 }, { minQty: 2 }, { minQty: 2 }])).toEqual([2]);
    expect(duplicateMinQtys([])).toEqual([]);
  });
});
