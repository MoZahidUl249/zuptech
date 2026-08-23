import { beforeAll, describe, expect, mock, test } from "bun:test";

/**
 * Re-costing a placed order for a corrected delivery zone.
 *
 * The thing these guard is that the GOODS never move. A customer picks
 * "inside Dhaka" and writes an address in Bogura; staff correct the zone and
 * the delivery and installation change — but the unit prices were agreed at
 * checkout and are inputs here, not something to look up again. `priceCart`
 * would re-read the catalogue, which is right at checkout and wrong now.
 */

const PRODUCT = {
  id: "ips1000",
  name: "1000VA IPS",
  price: 1000,
  onSale: false,
  salePrice: 0,
  deliveryFeeInsideDhaka: 100,
  deliveryFeeOutsideDhaka: 200,
  installationFeeInsideDhaka: 50,
  installationFeeOutsideDhaka: 80,
  freeDeliveryOffers: [] as { minQty: number; amount: number }[],
};

mock.module("./db", () => ({
  prisma: {
    product: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        [PRODUCT].filter((p) => where.id.in.includes(p.id)),
    },
  },
}));

let repriceOrderForZone: typeof import("./pricing").repriceOrderForZone;

beforeAll(async () => {
  ({ repriceOrderForZone } = await import("./pricing"));
});

/** Two units bought at a price that is NOT today's catalogue price. */
const placed = [{ productId: "ips1000", qty: 2, unitPrice: 850 }];

describe("repriceOrderForZone", () => {
  test("moves the two zone fees and nothing else", async () => {
    const outside = await repriceOrderForZone(placed, false);

    expect(outside.deliveryFee).toBe(400); // 200 per unit × 2
    expect(outside.installationFee).toBe(160); // 80 × 2
    expect(outside.total).toBe(1700 + 400 + 160);
  });

  test("the goods keep the price the customer agreed to", async () => {
    // 850 was frozen at checkout; the catalogue says 1000 today. If this ever
    // returns 2000 the order has been silently repriced, which is the whole
    // reason this is not `priceCart`.
    const inside = await repriceOrderForZone(placed, true);
    const outside = await repriceOrderForZone(placed, false);

    expect(inside.subtotal).toBe(1700);
    expect(outside.subtotal).toBe(1700);
    expect(outside.subtotal).toBe(inside.subtotal);
  });

  test("per-unit line snapshots come back so the order rows stay consistent", async () => {
    const { lines } = await repriceOrderForZone(placed, false);
    expect(lines).toEqual([{ productId: "ips1000", deliveryFee: 200, installationFee: 80 }]);
  });

  test("the free-delivery ladder still applies, per zone", async () => {
    PRODUCT.freeDeliveryOffers = [{ minQty: 2, amount: 150 }];
    try {
      const inside = await repriceOrderForZone(placed, true);
      const outside = await repriceOrderForZone(placed, false);
      // Inside: 100 − 150 floors at 0. Outside: 200 − 150 = 50 each.
      expect(inside.deliveryFee).toBe(0);
      expect(outside.deliveryFee).toBe(100);
    } finally {
      PRODUCT.freeDeliveryOffers = [];
    }
  });

  test("a product deleted since the order was placed is refused, not guessed", async () => {
    await expect(
      repriceOrderForZone([{ productId: "gone", qty: 1, unitPrice: 500 }], true),
    ).rejects.toThrow(/no longer exists/);
  });
});
