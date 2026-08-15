import { t } from "elysia";
import { cartItemsDto, orderStatusDto } from "./common";

/**
 * Checkout payload (cal-bk.md §2.2) — no money fields exist here; totals are
 * recomputed server-side, never trusted.
 *
 * `name`/`phone`/`address` are optional at the schema level because a
 * signed-in customer checks out with nothing but `{ items, pay, insideDhaka }`
 * — their identity and saved address come from the session, not the body.
 * For a guest all three are required, which the handler enforces (it has to
 * anyway: `address` needs a trimmed-length check the schema can't express).
 */
export const createOrderDto = t.Object({
  name: t.Optional(t.String({ maxLength: 120 })),
  phone: t.Optional(t.String()),
  address: t.Optional(t.String({ maxLength: 500 })),
  insideDhaka: t.Boolean(),
  pay: t.String({ minLength: 1, maxLength: 40 }),
  items: cartItemsDto,
  /** Signed-in only: persist this address/zone as the account's new default. */
  saveAddress: t.Optional(t.Boolean()),
  /**
   * The campaign page this order came from, when it came from one.
   *
   * A slug rather than an id because that is what the page already knows, and
   * it is checked against the published set server-side — a guessed or stale
   * slug attributes nothing rather than inventing a sale.
   */
  landingPageSlug: t.Optional(t.String({ maxLength: 120 })),
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
