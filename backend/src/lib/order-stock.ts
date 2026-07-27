import type { Tx } from "./db";
import type { OrderStatus } from "./rules";

/**
 * How each order status relates to inventory:
 *  - held      — units are reserved for the order (Processing/Confirmed/On the way)
 *  - consumed  — units left the warehouse (Delivered)
 *  - released  — no claim on stock (Cancelled)
 *
 * `applyStatusTransition` translates a status change into the right stock
 * mutations and writes a StockMovement whenever physical stock changes, so
 * the audit trail always matches reality (BACKEND.md §4.3–4.6).
 */

type StockState = "held" | "consumed" | "released";

const STATE_OF: Record<OrderStatus, StockState> = {
  Processing: "held",
  Confirmed: "held",
  "On the way": "held",
  Delivered: "consumed",
  Cancelled: "released",
};

interface OrderForStock {
  id: string;
  items: { productId: string; qty: number }[];
}

export async function applyStatusTransition(
  tx: Tx,
  order: OrderForStock,
  from: OrderStatus,
  to: OrderStatus,
  byUsername: string,
) {
  const before = STATE_OF[from];
  const after = STATE_OF[to];
  if (before === after) return;

  for (const item of order.items) {
    const q = item.qty;

    // Reservation bookkeeping (held ↔ anything).
    const reservedDelta = (after === "held" ? q : 0) - (before === "held" ? q : 0);
    // Physical stock only moves when units are consumed or un-consumed.
    const stockDelta = (before === "consumed" ? q : 0) - (after === "consumed" ? q : 0);
    // `sold` mirrors consumption; `0 - x` (not `-x`) keeps a zero delta at +0.
    const soldDelta = 0 - stockDelta;

    const product = await tx.product.update({
      where: { id: item.productId },
      data: {
        reserved: { increment: reservedDelta },
        stock: { increment: stockDelta },
        sold: { increment: soldDelta },
      },
    });

    if (stockDelta !== 0) {
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          sku: product.sku,
          change: stockDelta,
          reason:
            stockDelta < 0
              ? `Order ${order.id} delivered`
              : `Order ${order.id} delivery reverted`,
          by: byUsername,
        },
      });
    }
  }
}
