import { Elysia } from "elysia";
import { createPaymentMethodDto, updatePaymentMethodDto } from "../../dtos/payments.dto";
import { prisma } from "../../lib/db";
import { conflict, notFound } from "../../lib/http";
import { assertCan } from "../../lib/rbac";
import { isMaskedSecret } from "../../lib/rules";
import { toPaymentMethod } from "../../lib/serialize";
import { staffGuard } from "./guard";

/**
 * Payment method configuration. Secrets are write-only: responses always
 * mask apiSecret, and a submitted value that still looks like our mask (or
 * is empty on an existing method) means "keep what's stored".
 */

/**
 * Merge submitted provider credentials over the stored ones, field by field.
 *
 * The same "a mask means unchanged" rule as apiKey/apiSecret, applied per key
 * — and the merge matters more here than there. EPS needs five credentials and
 * the form round-trips all five as masks, so a whole-object write would
 * replace four live secrets with asterisks the moment someone retyped the
 * fifth. Fields absent from the submission are left alone entirely.
 */
function mergeCredentials(
  stored: unknown,
  submitted: Record<string, string | undefined>,
): Record<string, string> {
  const base =
    stored && typeof stored === "object" ? { ...(stored as Record<string, string>) } : {};

  for (const [key, value] of Object.entries(submitted)) {
    if (value === undefined || value === "" || isMaskedSecret(value)) continue;
    base[key] = value;
  }
  return base;
}
export const adminPayments = new Elysia({ name: "routes/admin/payments", detail: { tags: ["Admin · Payments"] } })
  .use(staffGuard)

  .get("/admin/api/payment-methods", async ({ staffCtx }) => {
    assertCan(staffCtx, "payments", "view");
    const methods = await prisma.paymentMethod.findMany({ orderBy: { sort: "asc" } });
    return methods.map(toPaymentMethod);
  })

  .post(
    "/admin/api/payment-methods",
    async ({ body, staffCtx, set }) => {
      assertCan(staffCtx, "payments", "manage");

      const clash = await prisma.paymentMethod.findUnique({ where: { id: body.id } });
      if (clash) throw conflict(`Payment method "${body.id}" already exists`);

      const sort = await prisma.paymentMethod.count();
      const method = await prisma.paymentMethod.create({ data: { ...body, sort } });
      set.status = 201;
      return toPaymentMethod(method);
    },
    { body: createPaymentMethodDto },
  )

  .put(
    "/admin/api/payment-methods/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "payments", "manage");

      const existing = await prisma.paymentMethod.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Payment method");

      // Both credentials round-trip through the form as masks, so an unchanged
      // field arrives looking like "••••1234". Writing that back would replace
      // the credential with its own mask, which is why neither is ever taken
      // from the body unless it has actually been retyped.
      const { apiKey, apiSecret, credentials, ...rest } = body;
      const unchanged = (value: string | undefined) =>
        value === undefined || value === "" || isMaskedSecret(value);

      const method = await prisma.paymentMethod.update({
        where: { id: params.id },
        data: {
          ...rest,
          ...(unchanged(apiKey) ? {} : { apiKey }),
          ...(unchanged(apiSecret) ? {} : { apiSecret }),
          ...(credentials ? { credentials: mergeCredentials(existing.credentials, credentials) } : {}),
        },
      });
      return toPaymentMethod(method);
    },
    { body: updatePaymentMethodDto },
  )

  .delete("/admin/api/payment-methods/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "payments", "manage");

    const existing = await prisma.paymentMethod.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound("Payment method");

    await prisma.paymentMethod.delete({ where: { id: params.id } });
    return { ok: true };
  });
