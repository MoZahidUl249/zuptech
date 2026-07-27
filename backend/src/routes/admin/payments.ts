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

      const { apiSecret, ...rest } = body;
      const keepStored = apiSecret === undefined || apiSecret === "" || isMaskedSecret(apiSecret);

      const method = await prisma.paymentMethod.update({
        where: { id: params.id },
        data: { ...rest, ...(keepStored ? {} : { apiSecret }) },
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
