import { t } from "elysia";

const paymentMethodFields = {
  name: t.String({ minLength: 2, maxLength: 100 }),
  kind: t.Union([
    t.Literal("Mobile wallet"),
    t.Literal("Card gateway"),
    t.Literal("Offline"),
  ]),
  provider: t.String({ maxLength: 100 }),
  providers: t.Array(t.String({ maxLength: 100 }), { maxItems: 10 }),
  enabled: t.Boolean(),
  environment: t.Union([t.Literal("Live"), t.Literal("Test")]),
  apiKey: t.String({ maxLength: 300 }),
  apiSecret: t.String({ maxLength: 300 }),
  webhookUrl: t.String({ maxLength: 300 }),
  isGateway: t.Boolean(),
};

export const createPaymentMethodDto = t.Object({
  id: t.String({ minLength: 2, maxLength: 50, pattern: "^[a-z0-9-]+$" }),
  ...paymentMethodFields,
});

/** apiKey/apiSecret are write-only: empty or still-masked values mean "keep stored". */
export const updatePaymentMethodDto = t.Partial(t.Object(paymentMethodFields));

/** Shared gateway callback shape — see routes/public/webhooks.ts caveats. */
export const paymentWebhookDto = t.Object({
  orderId: t.String(),
  paid: t.Boolean(),
  transactionId: t.Optional(t.String({ maxLength: 100 })),
});

export type CreatePaymentMethodDto = typeof createPaymentMethodDto.static;
export type UpdatePaymentMethodDto = typeof updatePaymentMethodDto.static;
export type PaymentWebhookDto = typeof paymentWebhookDto.static;
