import { randomUUID } from "node:crypto";
import { Elysia } from "elysia";
import type { Prisma } from "../../generated/client";
import { prisma } from "../../lib/db";
import { ApiError, badRequest, notFound } from "../../lib/http";
import { setOrderStatus } from "../../lib/order-status";
import { initPayment, parseEpsCredentials, verifyPayment } from "../../lib/payments/eps";
import { storefrontUrl } from "../../lib/payments/urls";
import { allowHit, clientIp } from "../../lib/rate-limit";
import { PAYMENT_ENVIRONMENTS, coerceTo } from "../../lib/rules";

/**
 * Online payment: start an attempt, and find out how it ended.
 *
 * The shape of the whole flow, and why:
 *
 *   POST /api/orders/:id/pay        → { redirectUrl, merchantTxnId }
 *   GET  /api/payments/:txn/status  → { paid, orderId, status }
 *
 * Checkout still creates the order as "Processing" exactly as before — an
 * order exists whether or not the customer completes payment, because an
 * abandoned payment is a sales lead and a lost order is nothing.
 *
 * The status endpoint is keyed on the **transaction id, not the order id**,
 * and that is deliberate. Order ids are sequential and printed on invoices
 * ("ZT-10241"), so keying on them would let anyone walk the range and learn
 * which orders are paid. `merchantTxnId` is a random UUID that only the
 * customer who started the payment (and EPS) ever sees.
 *
 * Payment is confirmed ONLY by asking EPS. The customer arrives back on a URL
 * that anyone could type; what moves the order is the server-to-server status
 * call, and it is safe to run repeatedly.
 */
export const publicPayments = new Elysia({
  name: "routes/public/payments",
  detail: { tags: ["Checkout"] },
})
  .post("/api/orders/:id/pay", async ({ params, request, server }) => {
    // Rate-limited like checkout itself: order ids are guessable, so without
    // this someone could walk the range opening gateway sessions. They would
    // gain nothing — the worst case is paying a stranger's bill — but it is
    // free traffic against our merchant account, and EPS counts it.
    const ip = clientIp(request, server);
    if (!allowHit(`pay-ip:${ip}`, 30, 5 * 60_000)) {
      throw new ApiError(429, "Too many payment attempts — try again in a few minutes");
    }

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { payments: true },
    });
    if (!order) throw notFound("Order");

    if (order.payments.some((p) => p.status === "Paid")) {
      throw badRequest("This order has already been paid");
    }
    if (order.status !== "Processing") {
      throw badRequest(`This order is ${order.status} and is not awaiting payment`);
    }

    const method = await prisma.paymentMethod.findFirst({
      where: { name: order.pay, enabled: true },
    });
    if (!method) throw badRequest(`Payment method "${order.pay}" is not available`);
    if (!method.isGateway) {
      throw badRequest(`"${order.pay}" is not an online payment method`);
    }
    if (method.provider.toLowerCase() !== "eps") {
      throw badRequest(`No online payment integration for "${method.provider}"`);
    }

    const creds = parseEpsCredentials(method.credentials);
    const environment = coerceTo(PAYMENT_ENVIRONMENTS, method.environment, "Test");

    // Ours, unguessable, and the key EPS answers every later question about.
    const merchantTxnId = randomUUID();
    const base = storefrontUrl();

    const { redirectUrl, providerTxnId } = await initPayment({
      creds,
      environment,
      merchantTxnId,
      amount: order.total,
      customerName: order.name,
      // EPS wants an email and the storefront never collects one — orders are
      // placed with a phone number. A per-transaction synthetic address keeps
      // the field valid without inventing a mailbox that might belong to
      // somebody real.
      customerEmail: `${merchantTxnId}@orders.zuptech.local`,
      customerPhone: order.phone,
      customerAddress: order.address,
      productName: `ZUP TECH order ${order.id}`,
      ipAddress: ip,
      successUrl: `${base}/checkout/payment/success?txn=${merchantTxnId}`,
      failUrl: `${base}/checkout/payment/failed?txn=${merchantTxnId}`,
      cancelUrl: `${base}/checkout/payment/cancelled?txn=${merchantTxnId}`,
    });

    // Written only after EPS accepted the session: a row here means an attempt
    // the gateway actually knows about, so a status query can never ask about
    // an id EPS has never seen.
    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        methodId: method.id,
        provider: "eps",
        merchantTxnId,
        providerTxnId,
        amount: order.total,
        status: "Initiated",
        redirectUrl,
      },
    });

    return { redirectUrl, merchantTxnId };
  })

  /**
   * Ask EPS how the payment ended, and move the order if it succeeded.
   *
   * Idempotent by construction: an attempt already settled answers from the
   * stored row without calling out again, and `setOrderStatus` is a no-op when
   * the order has already moved. Safe to poll, safe to refresh, safe to
   * receive twice from a callback.
   */
  .get("/api/payments/:txn/status", async ({ params, request, server }) => {
    const ip = clientIp(request, server);
    if (!allowHit(`pay-status-ip:${ip}`, 60, 5 * 60_000)) {
      throw new ApiError(429, "Too many status checks — try again in a few minutes");
    }

    const txn = await prisma.paymentTransaction.findUnique({
      where: { merchantTxnId: params.txn },
    });
    if (!txn) throw notFound("Payment");

    if (txn.status !== "Initiated") {
      return { paid: txn.status === "Paid", status: txn.status, orderId: txn.orderId };
    }

    const settled = await settlePayment(txn.merchantTxnId);
    return { paid: settled.paid, status: settled.status, orderId: txn.orderId };
  });

/**
 * The gateway's reply, stored verbatim. Prisma's Json input type does not
 * accept a bare `Record<string, unknown>` (it cannot prove the values are
 * JSON-serializable), and this one demonstrably is — it came out of
 * `JSON.parse`.
 */
const asJson = (value: Record<string, unknown>) => value as Prisma.InputJsonObject;

/**
 * Verify one attempt against EPS and record the outcome.
 *
 * Exported because the IPN callback in `webhooks.ts` must reach the same
 * decision the same way — a callback body is a notification that something
 * happened, never evidence of what.
 */
export async function settlePayment(
  merchantTxnId: string,
): Promise<{ paid: boolean; status: string }> {
  const txn = await prisma.paymentTransaction.findUnique({ where: { merchantTxnId } });
  if (!txn) throw notFound("Payment");

  // Already decided. Do not ask again, and above all do not move the order
  // again — the stock deltas behind a status change are not free to repeat.
  if (txn.status !== "Initiated") {
    return { paid: txn.status === "Paid", status: txn.status };
  }

  const method = await prisma.paymentMethod.findUnique({ where: { id: txn.methodId } });
  if (!method) throw badRequest("The payment method this was taken through no longer exists");

  const creds = parseEpsCredentials(method.credentials);
  const environment = coerceTo(PAYMENT_ENVIRONMENTS, method.environment, "Test");
  const result = await verifyPayment(creds, environment, merchantTxnId);

  // "Unknown" means EPS has no record yet — the customer may still be on the
  // gateway's page. Leave the attempt open so a later check can settle it,
  // rather than writing a failure the customer would have to argue with.
  if (!result.paid && result.status === "unknown") {
    return { paid: false, status: "Initiated" };
  }

  if (!result.paid) {
    await prisma.paymentTransaction.update({
      where: { merchantTxnId },
      data: {
        status: result.status === "cancelled" ? "Cancelled" : "Failed",
        providerTxnId: result.providerTxnId,
        raw: asJson(result.raw),
        verifiedAt: new Date(),
      },
    });
    return { paid: false, status: result.status === "cancelled" ? "Cancelled" : "Failed" };
  }

  /*
   * Paid — but check the amount before believing it.
   *
   * `totalAmount` is sent to the gateway by us and comes back from it, and the
   * customer sits in between on the gateway's own page. If what EPS says was
   * paid is less than what the order costs, this is not a completed sale and
   * must not be treated as one; it goes to a human instead of quietly
   * confirming an underpaid order.
   */
  if (result.paidAmount < txn.amount) {
    await prisma.paymentTransaction.update({
      where: { merchantTxnId },
      data: {
        status: "Failed",
        providerTxnId: result.providerTxnId,
        raw: asJson(result.raw),
        verifiedAt: new Date(),
      },
    });
    throw badRequest(
      `Paid amount ৳${result.paidAmount} is less than the order total ৳${txn.amount} — this order needs a human`,
    );
  }

  await prisma.$transaction(async (tx) => {
    // The unique key does the deduplication: two callbacks racing each other
    // both read "Initiated", both get here, and only the one whose update
    // matches a still-"Initiated" row proceeds.
    const claimed = await tx.paymentTransaction.updateMany({
      where: { merchantTxnId, status: "Initiated" },
      data: {
        status: "Paid",
        providerTxnId: result.providerTxnId,
        raw: asJson(result.raw),
        verifiedAt: new Date(),
      },
    });
    if (claimed.count === 0) return;

    await setOrderStatus(tx, txn.orderId, "Confirmed", "eps");
  });

  return { paid: true, status: "Paid" };
}
