import { Elysia } from "elysia";
import { updateSmsSettingsDto } from "../../dtos/messaging.dto";
import { prisma } from "../../lib/db";
import { assertCan } from "../../lib/rbac";
import { isMaskedSecret } from "../../lib/rules";
import { toSmsSettings } from "../../lib/serialize";
import { smsSettings } from "../../lib/sms";
import { staffGuard } from "./guard";

/**
 * Which text messages go out, and the account they go out through.
 *
 * Gated on `messaging` rather than `sitecontent`: this screen holds a provider
 * credential, and every switch on it spends money per send. That is a
 * different kind of decision from editing a heading.
 *
 * Nothing public reads `SmsSettings` — `GET /api/site-config` is a public
 * endpoint and the credentials deliberately do not live on that row.
 */
export const adminMessaging = new Elysia({
  name: "routes/admin/messaging",
  detail: { tags: ["Admin · Messaging"] },
})
  .use(staffGuard)

  .get("/admin/api/sms-settings", async ({ staffCtx }) => {
    assertCan(staffCtx, "messaging", "view");
    // Upserts the row on first read, so a fresh database needs no seed.
    return toSmsSettings(await smsSettings());
  })

  .put(
    "/admin/api/sms-settings",
    async ({ body, staffCtx }) => {
      assertCan(staffCtx, "messaging", "manage");

      const existing = await smsSettings();

      /*
       * Credentials are write-only, so the form round-trips them as masks.
       * Writing a mask back would replace a live credential with its own
       * asterisks — which is exactly what happens if someone flips one toggle
       * and saves. Same rule as routes/admin/payments.ts.
       */
      const { username, apiKey, ...rest } = body;
      const unchanged = (value: string | undefined) =>
        value === undefined || value === "" || isMaskedSecret(value);

      const updated = await prisma.smsSettings.update({
        where: { id: existing.id },
        data: {
          ...rest,
          ...(unchanged(username) ? {} : { username }),
          ...(unchanged(apiKey) ? {} : { apiKey }),
        },
      });

      return toSmsSettings(updated);
    },
    { body: updateSmsSettingsDto },
  );
