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
   *
   * It also SELECTS A PRICE LADDER: a campaign may carry its own bulk prices,
   * and one lookup decides both the price and the credit so the two cannot
   * disagree. That does not weaken the rule above — the prices come from the
   * campaign's stored rows, never from anything in this body.
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
  /**
   * Correct the delivery zone of an order already placed, and re-cost it.
   *
   * The customer picks the zone at checkout and can be wrong — "inside Dhaka"
   * with an address in Bogura. This is the manual fix, gated on `orderadjust`
   * rather than `orders`.
   *
   * Note what is NOT here: any money. The server recomputes delivery and
   * installation from the corrected zone and the product's own fee columns,
   * exactly as checkout did, and keeps the unit prices frozen on the order.
   * The rule that a client never supplies an amount is untouched.
   */
  insideDhaka: t.Optional(t.Boolean()),
  /**
   * Override the two fees outright — a courier surcharge, a negotiated
   * delivery, something the catalogue cannot express.
   *
   * This IS a human-entered amount, and the only one in the system. It is
   * therefore authenticated, permissioned, requires a written reason, and
   * writes an append-only event naming the staff member and both numbers. The
   * invariant it bends is "no CLIENT-supplied money" (cal-bk.md §3); a
   * deliberate act by a named operator with an audit trail is a different
   * thing from a forged request body.
   */
  adjust: t.Optional(
    t.Object({
      deliveryFee: t.Optional(t.Integer({ minimum: 0, maximum: 1_000_000 })),
      installationFee: t.Optional(t.Integer({ minimum: 0, maximum: 1_000_000 })),
      /** Required — an unexplained change to someone's bill is not auditable. */
      reason: t.String({ minLength: 3, maxLength: 200 }),
    }),
  ),
});

export type CreateOrderDto = typeof createOrderDto.static;
export type ListOrdersQueryDto = typeof listOrdersQueryDto.static;
export type UpdateOrderDto = typeof updateOrderDto.static;
