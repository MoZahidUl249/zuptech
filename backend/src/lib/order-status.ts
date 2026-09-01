import { Prisma } from "../generated/client";
import type { Tx } from "./db";
import { conflict, notFound } from "./http";
import { logOrderEvent } from "./order-events";
import { applyStatusTransition } from "./order-stock";
import type { StaffContext } from "./rbac";
import { parseOrderStatus, type OrderStatus } from "./rules";
import { ensureWarranties } from "./warranty";

/**
 * The one place a placed order's status may change.
 *
 * Advancing a status is never just a column write: `applyStatusTransition`
 * (order-stock.ts) moves reserved/physical stock and writes the StockMovement
 * trail, `Delivered` starts warranty cover, and the update itself needs an
 * optimistic guard or two concurrent writers both apply their stock deltas.
 *
 * That sequence lived inline in the admin PATCH handler and was correct there.
 * It stopped being enough the moment a second caller appeared — a payment
 * confirmation and, later, a courier's delivery callback both move orders
 * without a human. A reimplementation that forgets the guard, or the
 * warranties, is a silent inventory bug, so both steps live here and every
 * caller goes through them.
 *
 * `applyStatusChange` is for callers that are already assembling a wider
 * update (the admin route also rewrites zone and charges in the same
 * transaction). `setOrderStatus` is the whole operation for callers that only
 * want the status to move.
 */

/** Enough of an order to move its stock. */
interface OrderForStatus {
  id: string;
  status: string;
  items: { productId: string; qty: number }[];
}

/**
 * Stock deltas + audit entry for a status change, without writing the order
 * row — the caller owns that update and must include `status: to` in it, and
 * must scope it with `where: { id, status: from }` (see `statusGuard`).
 *
 * Returns false when `to` is already the current status, so callers can skip
 * the write entirely.
 */
export async function applyStatusChange(
  tx: Tx,
  order: OrderForStatus,
  to: OrderStatus,
  actor: StaffContext | null,
  actorUsername: string,
): Promise<boolean> {
  const from = parseOrderStatus(order.status);
  if (from === to) return false;

  await applyStatusTransition(tx, order, from, to, actorUsername);
  await logOrderEvent(tx, order.id, "status", `${from} → ${to}`, actor);
  return true;
}

/**
 * Optimistic concurrency guard for the order update that accompanies
 * `applyStatusChange`.
 *
 * Only matches while the row still holds the status that was read, so two
 * concurrent writers cannot both apply their stock deltas: the loser matches
 * zero rows, throws P2025, and rolls back its whole transaction. Pair it with
 * `asConcurrencyError` so the caller reports a conflict rather than a 500.
 */
export const statusGuard = (id: string, from: string) => ({ id, status: from });

/** P2025 from a guarded update means someone else moved the order first. */
export function asConcurrencyError(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    throw conflict("Order status changed concurrently — refresh and try again");
  }
  throw err;
}

/**
 * Delivery starts cover, and only once — `ensureWarranties` skips lines that
 * already have a row, so re-delivering never duplicates it.
 */
export async function ensureDeliveryWarranties(
  tx: Tx,
  order: Parameters<typeof ensureWarranties>[1],
  to: OrderStatus,
  actor: StaffContext | null,
): Promise<void> {
  if (to !== "Delivered") return;
  const created = await ensureWarranties(tx, order);
  if (created > 0) {
    await logOrderEvent(
      tx,
      order.id,
      "warranty",
      `${created} warranty record${created === 1 ? "" : "s"} generated`,
      actor,
    );
  }
}

/**
 * Move an order to `to` and nothing else: stock, audit trail, concurrency
 * guard and warranties, in the caller's transaction.
 *
 * Used by the payment confirmation and courier paths, where no human is
 * present. `actorUsername` is what the StockMovement trail records — pass
 * something that reads correctly months later ("eps", "steadfast"), because
 * "system" on every automated row makes the trail useless for telling them
 * apart.
 */
export async function setOrderStatus(
  tx: Tx,
  orderId: string,
  to: OrderStatus,
  actorUsername: string,
): Promise<boolean> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw notFound("Order");

  const moved = await applyStatusChange(tx, order, to, null, actorUsername);
  if (!moved) return false;

  try {
    const saved = await tx.order.update({
      where: statusGuard(order.id, order.status),
      data: { status: to },
      include: { items: true },
    });
    await ensureDeliveryWarranties(tx, saved, to, null);
  } catch (err) {
    asConcurrencyError(err);
  }
  return true;
}
