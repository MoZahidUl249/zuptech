import { t } from "elysia";
import { paymentEnvironmentDto, paymentKindDto } from "./common";

const paymentMethodFields = {
  name: t.String({ minLength: 2, maxLength: 100 }),
  kind: paymentKindDto,
  provider: t.String({ maxLength: 100 }),
  providers: t.Array(t.String({ maxLength: 100 }), { maxItems: 10 }),
  enabled: t.Boolean(),
  environment: paymentEnvironmentDto,
  apiKey: t.String({ maxLength: 300 }),
  apiSecret: t.String({ maxLength: 300 }),
  webhookUrl: t.String({ maxLength: 300 }),
  isGateway: t.Boolean(),
};

/**
 * Provider credentials that do not fit apiKey/apiSecret. EPS needs five.
 *
 * Write-only exactly like the two columns: a field arriving as the mask we
 * sent (or empty) means "keep what is stored", so an admin editing the
 * environment dropdown cannot silently overwrite a live credential with its
 * own asterisks.
 */
export const paymentCredentialsDto = t.Object({
  merchantId: t.Optional(t.String({ maxLength: 200 })),
  storeId: t.Optional(t.String({ maxLength: 200 })),
  username: t.Optional(t.String({ maxLength: 200 })),
  password: t.Optional(t.String({ maxLength: 200 })),
  hashKey: t.Optional(t.String({ maxLength: 400 })),
});

export const createPaymentMethodDto = t.Object({
  id: t.String({ minLength: 2, maxLength: 50, pattern: "^[a-z0-9-]+$" }),
  ...paymentMethodFields,
  credentials: t.Optional(paymentCredentialsDto),
});

/** apiKey/apiSecret are write-only: empty or still-masked values mean "keep stored". */
export const updatePaymentMethodDto = t.Partial(
  t.Object({ ...paymentMethodFields, credentials: paymentCredentialsDto }),
);

/**
 * EPS instant payment notification.
 *
 * Only the transaction id is read, and only to decide WHICH payment to go and
 * ask EPS about. Nothing else in the body is trusted or even required — a
 * callback tells us something happened, it does not tell us what. Both
 * spellings are accepted because EPS is inconsistent about the casing between
 * its redirect parameters and its callbacks.
 */
export const epsWebhookDto = t.Object({
  merchantTransactionId: t.Optional(t.String({ maxLength: 100 })),
  MerchantTransactionId: t.Optional(t.String({ maxLength: 100 })),
});

/** Shared gateway callback shape — see routes/public/webhooks.ts caveats. */
export const paymentWebhookDto = t.Object({
  orderId: t.String(),
  paid: t.Boolean(),
  transactionId: t.Optional(t.String({ maxLength: 100 })),
});

export type CreatePaymentMethodDto = typeof createPaymentMethodDto.static;
export type UpdatePaymentMethodDto = typeof updatePaymentMethodDto.static;
export type PaymentWebhookDto = typeof paymentWebhookDto.static;
export type EpsWebhookDto = typeof epsWebhookDto.static;
