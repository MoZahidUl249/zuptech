import { t } from "elysia";
import { cartItemsDto, orderStatusDto } from "./common";

/** Guest checkout payload (cal-bk.md §2.2) — no money fields exist here;
 *  totals are recomputed server-side, never trusted. */
export const createOrderDto = t.Object({
  name: t.String({ minLength: 2, maxLength: 120 }),
  phone: t.String(),
  address: t.String({ maxLength: 500 }),
  insideDhaka: t.Boolean(),
  pay: t.String({ minLength: 1, maxLength: 40 }),
  items: cartItemsDto,
});

export const listOrdersQueryDto = t.Object({
  q: t.Optional(t.String()),
  status: t.Optional(orderStatusDto),
  /** Staff id, or the literal "none" to list orders nobody has claimed. */
  preparedById: t.Optional(t.String({ maxLength: 40 })),
});

/**
 * Both fields optional so the admin can change either independently; the
 * handler rejects a body that sets neither. `preparedById: null` unassigns.
 */
export const updateOrderDto = t.Object({
  status: t.Optional(orderStatusDto),
  preparedById: t.Optional(t.Union([t.String({ maxLength: 40 }), t.Null()])),
});

export type CreateOrderDto = typeof createOrderDto.static;
export type ListOrdersQueryDto = typeof listOrdersQueryDto.static;
export type UpdateOrderDto = typeof updateOrderDto.static;
