import type { Tx } from "./db";
import type { StaffContext } from "./rbac";
import type { OrderEventKind } from "./rules";

/**
 * Append-only order history — who did what, when. Same audit philosophy as
 * StockMovement (`order-stock.ts`): the actor is frozen as plain text on the
 * row, so the trail still reads correctly after a staff member is renamed or
 * their Staff row is deleted.
 *
 * Always call this inside the caller's transaction so a failed mutation can't
 * leave an event claiming something happened that didn't.
 */

/** The storefront acts as itself — guest checkout has no staff context. */
const CUSTOMER_ACTOR = { by: "customer", byName: "Customer" } as const;

export async function logOrderEvent(
  tx: Tx,
  orderId: string,
  kind: OrderEventKind,
  detail: string,
  ctx: StaffContext | null,
): Promise<void> {
  const actor = ctx
    ? { by: ctx.staff.username, byName: ctx.staff.name }
    : CUSTOMER_ACTOR;

  await tx.orderEvent.create({ data: { orderId, kind, detail, ...actor } });
}
