import type { Tx } from "./db";
import { nextId } from "./ids";
import { warrantyEndsAt } from "./rules";

/**
 * Warranty registry generation. One Warranty row per delivered order line
 * whose product carries a warranty period — created automatically when an
 * order reaches "Delivered" (routes/admin/orders.ts) and on demand for orders
 * delivered before this feature existed (routes/admin/warranty.ts).
 *
 * The cover period starts at delivery, not at checkout: an order can sit in
 * "Processing" for weeks and the customer shouldn't lose that time.
 */

interface OrderItemForWarranty {
  id: number;
  productId: string;
  qty: number;
}

export interface OrderForWarranty {
  id: string;
  items: OrderItemForWarranty[];
}

/**
 * Idempotent: lines that already have a warranty are skipped, so re-delivering
 * an order (Delivered → Cancelled → Delivered) never duplicates cover, and
 * the existing row keeps its serial numbers and claim history.
 *
 * Returns how many rows were created so the caller can decide whether to log
 * an order event.
 */
export async function ensureWarranties(
  tx: Tx,
  order: OrderForWarranty,
  now: Date = new Date(),
): Promise<number> {
  if (order.items.length === 0) return 0;

  const existing = await tx.warranty.findMany({
    where: { orderItemId: { in: order.items.map((i) => i.id) } },
    select: { orderItemId: true },
  });
  const covered = new Set(existing.map((w) => w.orderItemId));

  const products = await tx.product.findMany({
    where: { id: { in: order.items.map((i) => i.productId) } },
    select: { id: true, sku: true, warrantyMonths: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  let created = 0;
  for (const item of order.items) {
    if (covered.has(item.id)) continue;
    const product = byId.get(item.productId);
    // A product with no warranty period gets no row at all — an empty registry
    // entry would just be noise for staff to scroll past.
    if (!product || product.warrantyMonths <= 0) continue;

    const { id, number } = await nextId(tx, "warranty");
    await tx.warranty.create({
      data: {
        id,
        number,
        orderId: order.id,
        orderItemId: item.id,
        productId: product.id,
        sku: product.sku,
        qty: item.qty,
        months: product.warrantyMonths,
        startsAt: now,
        endsAt: warrantyEndsAt(now, product.warrantyMonths),
      },
    });
    created++;
  }

  return created;
}
