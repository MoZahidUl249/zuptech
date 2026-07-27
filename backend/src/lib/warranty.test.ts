import { describe, expect, test } from "bun:test";
import type { Tx } from "./db";
import { warrantyEndsAt } from "./rules";
import { ensureWarranties } from "./warranty";

/**
 * ensureWarranties only touches warranty.findMany/create, product.findMany and
 * counter.upsert (via nextId), so a recording fake is enough to verify the
 * idempotency and the cover math without a database — same approach as
 * order-stock.test.ts.
 */

interface FakeProduct {
  id: string;
  sku: string;
  warrantyMonths: number;
}

interface CreatedWarranty {
  id: string;
  orderItemId: number;
  productId: string;
  sku: string;
  qty: number;
  months: number;
  startsAt: Date;
  endsAt: Date;
}

function fakeTx(products: FakeProduct[], alreadyCovered: number[] = []) {
  const created: CreatedWarranty[] = [];
  let counter = 4400;

  const fake = {
    warranty: {
      findMany: async () => alreadyCovered.map((orderItemId) => ({ orderItemId })),
      create: async (args: { data: CreatedWarranty }) => {
        created.push(args.data);
        return args.data;
      },
    },
    product: {
      findMany: async (args: { where: { id: { in: string[] } } }) =>
        products.filter((p) => args.where.id.in.includes(p.id)),
    },
    counter: {
      upsert: async () => ({ value: ++counter }),
    },
  };

  return { tx: fake as unknown as Tx, created };
}

const NOW = new Date("2026-07-27T10:00:00.000Z");

const order = {
  id: "ZT-10001",
  items: [
    { id: 1, productId: "ips1000", qty: 2 },
    { id: 2, productId: "cable", qty: 5 },
  ],
};

const catalog: FakeProduct[] = [
  { id: "ips1000", sku: "ZT-IPS-1000", warrantyMonths: 12 },
  { id: "cable", sku: "ZT-CBL-01", warrantyMonths: 0 },
];

describe("ensureWarranties", () => {
  test("creates one row per covered line and skips zero-warranty products", async () => {
    const { tx, created } = fakeTx(catalog);
    const count = await ensureWarranties(tx, order, NOW);

    expect(count).toBe(1);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      id: "WR-4401",
      orderItemId: 1,
      productId: "ips1000",
      sku: "ZT-IPS-1000",
      qty: 2,
      months: 12,
      startsAt: NOW,
    });
    expect(created[0]?.endsAt.toISOString()).toBe("2027-07-27T10:00:00.000Z");
  });

  test("is idempotent — lines that already have cover are left alone", async () => {
    const { tx, created } = fakeTx(catalog, [1]);
    const count = await ensureWarranties(tx, order, NOW);

    expect(count).toBe(0);
    expect(created).toEqual([]);
  });

  test("an order with no items does nothing", async () => {
    const { tx, created } = fakeTx(catalog);
    expect(await ensureWarranties(tx, { id: "ZT-10002", items: [] }, NOW)).toBe(0);
    expect(created).toEqual([]);
  });
});

describe("warrantyEndsAt", () => {
  test("adds whole months", () => {
    expect(warrantyEndsAt(new Date("2026-01-15T00:00:00Z"), 12).toISOString()).toBe(
      "2027-01-15T00:00:00.000Z",
    );
  });

  test("clamps to the last day when the target month is shorter", () => {
    // Naive month arithmetic would overflow 31 Jan + 1 month into 2/3 March.
    expect(warrantyEndsAt(new Date("2026-01-31T00:00:00Z"), 1).toISOString()).toBe(
      "2026-02-28T00:00:00.000Z",
    );
  });

  test("handles a leap-year February", () => {
    expect(warrantyEndsAt(new Date("2028-01-31T00:00:00Z"), 1).toISOString()).toBe(
      "2028-02-29T00:00:00.000Z",
    );
  });

  test("zero months is the start date", () => {
    expect(warrantyEndsAt(new Date("2026-03-10T00:00:00Z"), 0).toISOString()).toBe(
      "2026-03-10T00:00:00.000Z",
    );
  });
});
