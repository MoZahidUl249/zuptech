import { beforeAll, describe, expect, mock, test } from "bun:test";

/**
 * priceCart reads the catalog through the shared `prisma` singleton, so the
 * module is mocked before it is imported. Only product.findMany is used.
 */

interface FakeProduct {
  id: string;
  name: string;
  price: number;
  onSale: boolean;
  salePercentage: number;
  stock: number;
  reserved: number;
  reorderAt: number;
  deliveryFeeInsideDhaka: number;
  deliveryFeeOutsideDhaka: number;
  installationFeeInsideDhaka: number;
  installationFeeOutsideDhaka: number;
  quantityOffers: { minQty: number; percentage: number }[];
  freeDeliveryOffers: { minQty: number; percentage: number }[];
}

const CATALOG: FakeProduct[] = [
  {
    id: "ips1000",
    name: "1000VA IPS",
    price: 1000,
    onSale: false,
    salePercentage: 0,
    stock: 5,
    reserved: 0,
    reorderAt: 2,
    deliveryFeeInsideDhaka: 100,
    deliveryFeeOutsideDhaka: 200,
    installationFeeInsideDhaka: 50,
    installationFeeOutsideDhaka: 80,
    // 10+ units take 20% off the unit price.
    quantityOffers: [{ minQty: 10, percentage: 20 }],
    freeDeliveryOffers: [],
  },
];

mock.module("./db", () => ({
  prisma: {
    product: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        CATALOG.filter((p) => where.id.in.includes(p.id)),
    },
  },
}));

let priceCart: typeof import("./pricing").priceCart;

beforeAll(async () => {
  ({ priceCart } = await import("./pricing"));
});

describe("priceCart", () => {
  test("prices a single line from the catalog, never from the client", async () => {
    const cart = await priceCart([{ productId: "ips1000", qty: 2 }], true);
    expect(cart.subtotal).toBe(2000);
    expect(cart.deliveryFee).toBe(200);
    expect(cart.installationFee).toBe(100);
    expect(cart.total).toBe(2300);
  });

  test("rejects a quantity the catalog can't cover", async () => {
    await expect(
      priceCart([{ productId: "ips1000", qty: 6 }], true, { enforceStock: true }),
    ).rejects.toThrow(/Only 5 .* in stock/);
  });

  /**
   * The regression this file was written for. Repeated lines for one product
   * used to be priced independently: each cleared the stock check on its own,
   * so a cart of 3×5 passed against a stock of 5 and then reserved 15.
   */
  test("merges duplicate lines before enforcing stock", async () => {
    await expect(
      priceCart(
        [
          { productId: "ips1000", qty: 5 },
          { productId: "ips1000", qty: 5 },
          { productId: "ips1000", qty: 5 },
        ],
        true,
        { enforceStock: true },
      ),
    ).rejects.toThrow(/Only 5 .* in stock/);
  });

  test("merged lines collapse into one order line", async () => {
    const cart = await priceCart(
      [
        { productId: "ips1000", qty: 2 },
        { productId: "ips1000", qty: 3 },
      ],
      true,
    );
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]!.qty).toBe(5);
    expect(cart.subtotal).toBe(5000);
  });

  /**
   * Splitting a cart across lines used to cost the customer their discount:
   * two lines of 5 each resolved the tier on qty 5, missing the 10+ tier the
   * 10 units they actually bought qualify for.
   */
  test("quantity-offer tiers resolve on the merged total", async () => {
    const split = await priceCart(
      [
        { productId: "ips1000", qty: 5 },
        { productId: "ips1000", qty: 5 },
      ],
      undefined,
    );
    const whole = await priceCart([{ productId: "ips1000", qty: 10 }], undefined);
    expect(split.subtotal).toBe(whole.subtotal);
    expect(split.subtotal).toBe(8000); // 10 × 800, the 20% tier
  });

  test("caps the merged quantity, so the per-line cap can't be split around", async () => {
    await expect(
      priceCart(
        [
          { productId: "ips1000", qty: 60 },
          { productId: "ips1000", qty: 60 },
        ],
        true,
      ),
    ).rejects.toThrow(/At most 99/);
  });

  test("an unorderable product is indistinguishable from an unknown one", async () => {
    await expect(priceCart([{ productId: "nope", qty: 1 }], true)).rejects.toThrow(
      /Unknown product/,
    );
  });
});
