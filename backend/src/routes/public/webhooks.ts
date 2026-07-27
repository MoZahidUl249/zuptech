import { Elysia } from "elysia";
import { paymentWebhookDto } from "../../dtos/payments.dto";
import { prisma } from "../../lib/db";
import { notFound, unauthorized } from "../../lib/http";
import { isOneOf } from "../../lib/rules";

/**
 * Payment gateway callbacks (bKash / Nagad / SSLCommerz).
 *
 * Flow (BACKEND.md §3): an order is created as "Processing"; wallet/card
 * methods then trigger a payment request, and the gateway confirms via these
 * webhooks → order moves to "Confirmed".
 *
 * ⚠️ These are STUBS with the shared shape wired up. Each provider's real
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
    if (!method.apiSecret || headers["x-webhook-secret"] !== method.apiSecret) {
      throw unauthorized("Invalid webhook credentials");
    }

    const order = await prisma.order.findUnique({ where: { id: body.orderId } });
    if (!order) throw notFound("Order");

    if (body.paid && order.status === "Processing") {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "Confirmed" },
      });
      console.log(`[pay] ${method.name} confirmed ${order.id} (txn ${body.transactionId ?? "n/a"})`);
      return { ok: true, orderId: order.id, status: "Confirmed" };
    }

    return { ok: true, orderId: order.id, status: order.status };
  },
  { body: paymentWebhookDto },
);
