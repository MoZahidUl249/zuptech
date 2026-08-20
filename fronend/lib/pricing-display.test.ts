import { describe, expect, test } from "bun:test";
import { offerLadder } from "./pricing-display";
import type { Product } from "@/lib/products";

/*
 * The rule these pin down is the one that is easy to get wrong twice:
 *
 * A QuantityOffer's `amount` is taka off the LIST price, and the backend
 * charges min(sellingPrice, price - amount) — tiers and sales never stack, the
 * cheaper wins (backend rules.ts `effectiveUnitPrice`, pinned there by
 * rules.test.ts). So on a product that is also on sale, `amount` is NOT the
 * customer's saving, and a tier that fails to reach below the sale price is
 * worth nothing at all.
 *
 * The live case that prompted these: listed ৳2,600, on sale at ৳2,184, tier
 * amount ৳200. The page advertised "Save ৳200 per unit" and the basket did not
 * move by a single taka.
 */

const product = (): Product =>
  ({
    id: "p1",
    name: "Toolset",
    price: 2600,
    onSale: true,
    salePrice: 2184,
    quantityOffers: [],
    freeDeliveryOffers: [],
  }) as unknown as Product;

const qtyRungs = (p: Product) => offerLadder(p).filter((r) => r.kind === "qty");

describe("offerLadder — quantity tiers against a sale price", () => {
  test("a tier that cannot beat the sale price is not advertised at all", () => {
    // 2600 - 200 = 2400, which is worse than the 2184 the customer already
    // pays. Worth nothing, so it must not claim to be worth ৳200.
    const p = product();
    p.quantityOffers = [{ minQty: 2, amount: 200 }] as Product["quantityOffers"];
    expect(qtyRungs(p)).toEqual([]);
  });

  test("a tier that beats the sale reports the real drop, not its stored amount", () => {
    // 2600 - 600 = 2000, against the 2184 shown: the customer saves ৳184.
    const p = product();
    p.quantityOffers = [{ minQty: 2, amount: 600 }] as Product["quantityOffers"];
    const [rung] = qtyRungs(p);
    expect(rung?.amount).toBe(184);
    expect(rung?.detail).toContain("184");
    expect(rung?.detail).not.toContain("600");
  });

  test("with no sale running, the stored amount IS the saving", () => {
    const p = product();
    p.onSale = false;
    p.quantityOffers = [{ minQty: 3, amount: 500 }] as Product["quantityOffers"];
    const [rung] = qtyRungs(p);
    expect(rung?.amount).toBe(500);
  });

  test("each tier is measured independently against the shown price", () => {
    const p = product();
    p.quantityOffers = [
      { minQty: 2, amount: 600 },
      { minQty: 3, amount: 700 },
    ] as Product["quantityOffers"];
    expect(qtyRungs(p).map((r) => r.amount)).toEqual([184, 284]);
  });
});
