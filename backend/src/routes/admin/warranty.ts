import { Elysia } from "elysia";
import {
  generateWarrantiesDto,
  listWarrantiesQueryDto,
  updateWarrantyDto,
} from "../../dtos/warranty.dto";
import { prisma } from "../../lib/db";
import { badRequest, notFound } from "../../lib/http";
import { logOrderEvent } from "../../lib/order-events";
import { assertCan } from "../../lib/rbac";
import { warrantyEndsAt } from "../../lib/rules";
import { toWarranty } from "../../lib/serialize";
import { ensureWarranties } from "../../lib/warranty";
import { staffGuard } from "./guard";

/** Relations `toWarranty` needs. */
const warrantyInclude = {
  product: { select: { name: true } },
  order: { select: { name: true, phone: true } },
};

export const adminWarranty = new Elysia({
  name: "routes/admin/warranty",
  detail: { tags: ["Admin · Warranty"] },
})
  .use(staffGuard)

  .get(
    "/admin/api/warranties",
    async ({ query, staffCtx }) => {
      assertCan(staffCtx, "warranty", "view");

      const q = query.q?.trim();
      const warranties = await prisma.warranty.findMany({
        where: {
          ...(query.status ? { status: query.status } : {}),
          ...(q
            ? {
                OR: [
                  { id: { contains: q, mode: "insensitive" } },
                  { orderId: { contains: q, mode: "insensitive" } },
                  { serialNo: { contains: q, mode: "insensitive" } },
                  { sku: { contains: q, mode: "insensitive" } },
                  { product: { name: { contains: q, mode: "insensitive" } } },
                  { order: { name: { contains: q, mode: "insensitive" } } },
                  { order: { phone: { contains: q.replace(/[\s-]/g, "") } } },
                ],
              }
            : {}),
        },
        include: warrantyInclude,
        orderBy: { number: "desc" },
      });
      return warranties.map(toWarranty);
    },
    { query: listWarrantiesQueryDto },
  )

  /**
   * Backfill the registry for one order. Delivery generates warranties
   * automatically (routes/admin/orders.ts); this exists for orders delivered
   * before the registry did, and is safe to call repeatedly.
   */
  .post(
    "/admin/api/warranties",
    async ({ body, staffCtx }) => {
      assertCan(staffCtx, "warranty", "manage");

      const order = await prisma.order.findUnique({
        where: { id: body.orderId },
        include: { items: true },
      });
      if (!order) throw notFound("Order");
      if (order.status !== "Delivered") {
        throw badRequest("Warranty cover starts at delivery — this order isn't delivered yet");
      }

      const created = await prisma.$transaction(async (tx) => {
        const n = await ensureWarranties(tx, order);
        if (n > 0) {
          await logOrderEvent(
            tx,
            order.id,
            "warranty",
            `${n} warranty record${n === 1 ? "" : "s"} generated`,
            staffCtx,
          );
        }
        return n;
      });

      const warranties = await prisma.warranty.findMany({
        where: { orderId: order.id },
        include: warrantyInclude,
        orderBy: { number: "asc" },
      });
      return { created, warranties: warranties.map(toWarranty) };
    },
    { body: generateWarrantiesDto },
  )

  /** Record serials and claims. Changing the period re-derives the expiry. */
  .patch(
    "/admin/api/warranties/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "warranty", "manage");

      const existing = await prisma.warranty.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Warranty");

      const statusChanged = body.status !== undefined && body.status !== existing.status;

      const updated = await prisma.$transaction(async (tx) => {
        const saved = await tx.warranty.update({
          where: { id: existing.id },
          data: {
            ...(body.serialNo !== undefined ? { serialNo: body.serialNo } : {}),
            ...(body.status !== undefined ? { status: body.status } : {}),
            ...(body.claimNote !== undefined ? { claimNote: body.claimNote } : {}),
            // Expiry always counts from the original start date, so correcting
            // the period never silently shifts when cover began.
            ...(body.months !== undefined
              ? { months: body.months, endsAt: warrantyEndsAt(existing.startsAt, body.months) }
              : {}),
          },
          include: warrantyInclude,
        });

        if (statusChanged) {
          await logOrderEvent(
            tx,
            existing.orderId,
            "warranty",
            `Warranty ${existing.id} ${existing.status} → ${body.status}`,
            staffCtx,
          );
        }
        return saved;
      });

      return toWarranty(updated);
    },
    { body: updateWarrantyDto },
  );
