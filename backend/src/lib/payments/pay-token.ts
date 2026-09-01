import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Proof that the caller is the person who placed this order.
 *
 * `POST /api/orders/:id/pay` cannot be open. Order ids are sequential and
 * printed on invoices ("ZT-10241"), so without this anyone could walk the
 * range and open a gateway session against a stranger's order — which sends
 * that customer's name, phone and address to EPS and puts their total on a
 * payment page. Nobody is charged by it, but it is somebody else's data
 * leaving the building on a stranger's say-so.
 *
 * The token is an HMAC of the order id under the server's own secret, handed
 * back once at checkout to the browser that placed the order. Deliberately
 * derived rather than stored:
 *
 *   - no column, no migration, and nothing extra to leak from the database
 *   - it cannot drift out of sync with the order it belongs to
 *
 * The trade is that it cannot be revoked short of rotating
 * `BETTER_AUTH_SECRET`. That is acceptable for what it authorises — starting a
 * payment for one order, which only ever moves money *towards* us. It is not a
 * session, and nothing else should ever accept it.
 *
 * A signed-in customer who owns the order does not need one; the session is
 * already better proof.
 */

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) {
    // Falling back to a constant here would make every token forgeable by
    // anyone who has read this file. Refusing is the only safe answer.
    throw new Error("BETTER_AUTH_SECRET is not set — cannot sign payment tokens");
  }
  return value;
}

/** The token for an order. Same input, same output, every time. */
export function signPayToken(orderId: string): string {
  return createHmac("sha256", secret()).update(`pay:${orderId}`).digest("base64url");
}

/**
 * Constant-time comparison.
 *
 * Both sides are hashed first because `timingSafeEqual` throws on a length
 * mismatch, which would itself leak the token's length — the same reasoning as
 * `secretsMatch` in lib/rules.ts.
 */
export function payTokenMatches(orderId: string, supplied: string | undefined): boolean {
  if (!supplied) return false;
  const expected = createHmac("sha256", secret()).update(signPayToken(orderId)).digest();
  const given = createHmac("sha256", secret()).update(supplied).digest();
  return timingSafeEqual(expected, given);
}
