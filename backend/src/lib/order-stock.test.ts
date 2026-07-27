import { describe, expect, test } from "bun:test";
import type { Tx } from "./db";
import { applyStatusTransition } from "./order-stock";

/**
 * applyStatusTransition only touches tx.product.update and
 * tx.stockMovement.create, so a recording fake is enough to verify the
 * stock math and the audit trail without a database.
 */

interface RecordedUpdate {
  id: string;
  reserved: number;
  stock: number;
  sold: number;
}

interface RecordedMovement {
  productId: string;
  sku: string;
  change: number;
  reason: string;
  by: string;
}

function fakeTx() {
  const updates: RecordedUpdate[] = [];
  const movements: RecordedMovement[] = [];

  const fake = {
    product: {
      update: async (args: {
        where: { id: string };
        data: {
          reserved: { increment: number };
          stock: { increment: number };
          sold: { increment: number };
        };
      }) => {
        updates.push({
          id: args.where.id,
          reserved: args.data.reserved.increment,
          stock: args.data.stock.increment,
          sold: args.data.sold.increment,
        });
        return { id: args.where.id, sku: `SKU-${args.where.id}` };
      },
    },
    stockMovement: {
      create: async (args: { data: RecordedMovement }) => {
        movements.push(args.data);
        return args.data;
      },
    },
  };

  // Only the two methods above are exercised — the rest of Tx is irrelevant here.
  return { tx: fake as unknown as Tx, updates, movements };
}

const order = { id: "ZT-10001", items: [{ productId: "p1", qty: 2 }] };

describe("applyStatusTransition", () => {
  test("held → held is a no-op (Processing → Confirmed)", async () => {
    const { tx, updates, movements } = fakeTx();
    await applyStatusTransition(tx, order, "Processing", "Confirmed", "arif");
    expect(updates).toEqual([]);
    expect(movements).toEqual([]);
  });

  test("delivery consumes reserved units and logs a movement", async () => {
    const { tx, updates, movements } = fakeTx();
    await applyStatusTransition(tx, order, "Confirmed", "Delivered", "arif");
    expect(updates).toEqual([{ id: "p1", reserved: -2, stock: -2, sold: 2 }]);
    expect(movements).toEqual([
      { productId: "p1", sku: "SKU-p1", change: -2, reason: "Order ZT-10001 delivered", by: "arif" },
    ]);
  });

  test("reverting a delivery puts stock and reservation back", async () => {
    const { tx, updates, movements } = fakeTx();
    await applyStatusTransition(tx, order, "Delivered", "Processing", "arif");
    expect(updates).toEqual([{ id: "p1", reserved: 2, stock: 2, sold: -2 }]);
    expect(movements).toEqual([
      {
        productId: "p1",
        sku: "SKU-p1",
        change: 2,
        reason: "Order ZT-10001 delivery reverted",
        by: "arif",
      },
    ]);
  });

  test("cancelling releases the reservation without moving physical stock", async () => {
    const { tx, updates, movements } = fakeTx();
    await applyStatusTransition(tx, order, "On the way", "Cancelled", "nusrat");
    expect(updates).toEqual([{ id: "p1", reserved: -2, stock: 0, sold: 0 }]);
    expect(movements).toEqual([]);
  });

  test("un-cancelling re-reserves the units", async () => {
    const { tx, updates, movements } = fakeTx();
    await applyStatusTransition(tx, order, "Cancelled", "Processing", "nusrat");
    expect(updates).toEqual([{ id: "p1", reserved: 2, stock: 0, sold: 0 }]);
    expect(movements).toEqual([]);
  });
});
