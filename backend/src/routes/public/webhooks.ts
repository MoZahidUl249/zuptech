import { Elysia } from "elysia";
import { epsWebhookDto, paymentWebhookDto } from "../../dtos/payments.dto";
import { prisma } from "../../lib/db";
import { notFound, unauthorized } from "../../lib/http";
import { setOrderStatus } from "../../lib/order-status";
import { isOneOf, secretsMatch } from "../../lib/rules";
import { settlePayment } from "./payments";

/**
 * Payment gateway callbacks (bKash / Nagad / SSLCommerz).
 *
 * Flow (BACKEND.md §3): an order is created as "Processing"; wallet/card
 * methods then trigger a payment request, and the gateway confirms via these
 * webhooks → order moves to "Confirmed".
 *
 * EPS is the exception and lives at the bottom of this file: it is a real
 * integration, and it is safe precisely because it treats the callback body as
 * a hint rather than as evidence — see the comment there.
 *
 * ⚠️ The bKash / Nagad / card handlers below are STUBS with the shared shape
 * wired up. Each provider's real
 * signature/IPN scheme (each is different) still needs to be implemented
 * before going live, along with an initiate-payment call that stores the
 * gateway's transaction id on the order, and idempotent replay handling.
 * Until then, `x-webhook-secret` matching the configured `apiSecret` is the
 * only thing standing between this endpoint and an unauthenticated caller —
 * it is NOT equivalent to real gateway signature verification.
 */
const PROVIDERS = ["bkash", "nagad", "card"] as const;

export const paymentWebhooks = new Elysia({ name: "routes/public/webhooks", detail: { tags: ["Webhooks"] } }).post(
  "/pay/:provider",
  async ({ params, body, headers }) => {
    if (!isOneOf(PROVIDERS, params.provider)) {
      throw notFound("Payment provider");
    }

    const method = await prisma.paymentMethod.findFirst({
      where: { id: params.provider, enabled: true },
    });
    if (!method) throw notFound("Payment provider");

    // TODO(production): replace with each provider's real signature/IPN
    // verification (method.apiKey/apiSecret feed into that, differently per
    // gateway). Until then, require the shared secret so this isn't wide open.
    //
    // Compared in constant time. `!==` returned as soon as two bytes differed,
    // which let the secret be recovered a character at a time from response
    // timing instead of guessed whole — on the endpoint that marks orders paid.
    if (!secretsMatch(headers["x-webhook-secret"], method.apiSecret ?? undefined)) {
      throw unauthorized("Invalid webhook credentials");
    }

    const order = await prisma.order.findUnique({ where: { id: body.orderId } });
    if (!order) throw notFound("Order");

    if (body.paid && order.status === "Processing") {
      // Through the shared path rather than a bare column write: a status
      // change carries stock effects and an audit entry, and a second writer
      // of order status that skips them is how inventory quietly drifts.
      await prisma.$transaction((tx) => setOrderStatus(tx, order.id, "Confirmed", params.provider));
      console.log(`[pay] ${method.name} confirmed ${order.id} (txn ${body.transactionId ?? "n/a"})`);
      return { ok: true, orderId: order.id, status: "Confirmed" };
    }

    return { ok: true, orderId: order.id, status: order.status };
  },
  { body: paymentWebhookDto },
)

  /**
   * EPS instant payment notification.
   *
   * Two gates, and the second is the one that matters:
   *
   *   1. The shared secret, as above. It keeps strangers from making us do
   *      work, nothing more.
   *   2. `settlePayment` ignores this body entirely except for the id, and
   *      goes and asks EPS what happened. So even a caller holding the secret
   *      cannot mark an order paid — EPS has to say so.
   *
   * That is why this endpoint can be safely idempotent and safely retried:
   * every call re-derives the answer from the gateway, and an attempt that has
   * already settled short-circuits without moving anything.
   */
  .post(
    "/pay/eps",
    async ({ body, headers }) => {
      const method = await prisma.paymentMethod.findFirst({
        where: { provider: { equals: "eps", mode: "insensitive" }, enabled: true },
      });
      if (!method) throw notFound("Payment provider");

      if (!secretsMatch(headers["x-webhook-secret"], method.apiSecret ?? undefined)) {
        throw unauthorized("Invalid webhook credentials");
      }

      const merchantTxnId = body.merchantTransactionId ?? body.MerchantTransactionId;
      if (!merchantTxnId) throw notFound("Payment");

      const settled = await settlePayment(merchantTxnId);
      console.log(`[pay] eps ${merchantTxnId} → ${settled.status}`);
      return { ok: true, status: settled.status, paid: settled.paid };
    },
    { body: epsWebhookDto },
  );
