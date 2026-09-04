import { t } from "elysia";

/**
 * SMS provider settings.
 *
 * Credentials are write-only, exactly like a payment method's: responses carry
 * a mask, and a submitted value that is empty or still looks like our mask
 * means "keep what is stored". Without that rule, an admin flipping one toggle
 * would save the asterisks back over a live API key.
 */
export const updateSmsSettingsDto = t.Partial(
  t.Object({
    enabled: t.Boolean(),
    username: t.String({ maxLength: 200 }),
    apiKey: t.String({ maxLength: 300 }),
    senderId: t.String({ maxLength: 100 }),
    baseUrl: t.String({ maxLength: 300 }),
    otpEnabled: t.Boolean(),
    placedEnabled: t.Boolean(),
    shippedEnabled: t.Boolean(),
    deliveredEnabled: t.Boolean(),
  }),
);

export type UpdateSmsSettingsDto = typeof updateSmsSettingsDto.static;
