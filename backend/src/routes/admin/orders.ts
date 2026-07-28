import { Elysia } from "elysia";
import { listOrdersQueryDto, updateOrderDto } from "../../dtos/orders.dto";
import { Prisma } from "../../generated/client";
import { prisma } from "../../lib/db";
import { badRequest, conflict, notFound } from "../../lib/http";
import { logOrderEvent } from "../../lib/order-events";
import { applyStatusTransition } from "../../lib/order-stock";
import { assertCan } from "../../lib/rbac";
import { parseOrderStatus } from "../../lib/rules";
import { adminOrderInclude, toAdminOrder, toOrderDetail } from "../../lib/serialize";
import { ensureWarranties } from "../../lib/warranty";
import { staffGuard } from "./guard";

/** Relations the single-order detail view needs — see serialize.toOrderDetail. */
const orderDetailInclude = {
  items: { include: { product: { select: { name: true, sku: true, slug: true } } } },
  preparedBy: true,
  invoice: { include: { issuedBy: true } },
  warranties: {
    include: {
      product: { select: { name: true } },
      order: { select: { name: true, phone: true } },
    },
    orderBy: { number: "asc" as const },
  },
  events: { orderBy: { at: "desc" as const } },
  _count: { select: { warranties: true } },
};

export const adminOrders = new Elysia({ name: "routes/admin/orders", detail: { tags: ["Admin · Orders"] } })
  .use(staffGuard)

  /** List with free-text search (id / customer / phone) + status/owner filters. */
  .get(
    "/admin/api/orders",
    async ({ query, staffCtx }) => {
      assertCan(staffCtx, "orders", "view");

      const q = query.q?.trim();
      const orders = await prisma.order.findMany({
        where: {
          ...(query.status ? { status: query.status } : {}),
          // "none" is the only reserved value — anything else is a staff id.
          ...(query.preparedById
            ? query.preparedById === "none"
              ? { preparedById: null }
              : { preparedById: query.preparedById }
            : {}),
          ...(q
            ? {
                OR: [
                  { id: { contains: q, mode: "insensitive" } },
                  { name: { contains: q, mode: "insensitive" } },
                  { phone: { contains: q.replace(/[\s-]/g, "") } },
                ],
              }
            : {}),
        },
        include: adminOrderInclude,
        orderBy: { number: "desc" },
      });
      return orders.map(toAdminOrder);
    },
    { query: listOrdersQueryDto },
  )

  /** Everything one order screen needs — lines, audit trail, invoice, warranties. */
  .get("/admin/api/orders/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "orders", "view");

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: orderDetailInclude,
    });
    if (!order) throw notFound("Order");
    return toOrderDetail(order);
  })

  /**
   * Status and/or ownership change, both written to the order's audit trail.
   * Inventory follows the status automatically: Delivered consumes the
   * reserved units (and logs movements); Cancelled releases them; reverting
   * puts everything back (see lib/order-stock.ts). Delivery additionally
   * generates the warranty registry rows for that order.
   */
  .patch(
    "/admin/api/orders/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "orders", "manage");

      if (body.status === undefined && body.preparedById === undefined) {
        throw badRequest("Nothing to update — send status and/or preparedById");
      }

      // Resolve the assignee up front: a bad id should 404 before the
      // transaction below starts moving stock around.
      let preparedByName: string | null = null;
      if (body.preparedById) {
        const staff = await prisma.staff.findUnique({
          where: { id: body.preparedById },
          select: { name: true },
        });
        if (!staff) throw notFound("Staff member");
        preparedByName = staff.name;
      }

      try {
        const updated = await prisma.$transaction(async (tx) => {
          const order = await tx.order.findUnique({
            where: { id: params.id },
            include: { items: true, preparedBy: { select: { name: true } } },
          });
          if (!order) throw notFound("Order");
          const from = parseOrderStatus(order.status);

          const data: Prisma.OrderUpdateInput = {};

          if (body.status !== undefined && body.status !== from) {
            await applyStatusTransition(tx, order, from, body.status, staffCtx.staff.username);
            data.status = body.status;
            await logOrderEvent(tx, order.id, "status", `${from} → ${body.status}`, staffCtx);
          }

          if (body.preparedById !== undefined && body.preparedById !== order.preparedById) {
            data.preparedBy = body.preparedById
              ? { connect: { id: body.preparedById } }
              : { disconnect: true };
            await logOrderEvent(
              tx,
              order.id,
              "prepared-by",
              `Prepared by ${order.preparedBy?.name ?? "nobody"} → ${preparedByName ?? "nobody"}`,
              staffCtx,
            );
          }

          // Optimistic concurrency guard: this only matches if `status` is
          // still `from`, i.e. unchanged since the read above. Two concurrent
          // PATCHes on the same order both read the same stale status and
          // both apply the stock deltas above — without this guard the second
          // transaction's update would silently succeed too, double-applying
          // them. With it, the loser's update matches zero rows, throws, and
          // rolls back its entire transaction (including its stock deltas).
          const saved = await tx.order.update({
            where: { id: order.id, status: from },
            data,
            include: { items: true },
          });

          // Cover starts at delivery, and only once — ensureWarranties skips
          // lines that already have a row, so re-delivering never duplicates.
          if (body.status === "Delivered") {
            const created = await ensureWarranties(tx, saved);
            if (created > 0) {
              await logOrderEvent(
                tx,
                order.id,
                "warranty",
                `${created} warranty record${created === 1 ? "" : "s"} generated`,
                staffCtx,
              );
            }
          }

          // Re-read so the response carries the events and warranties written above.
          return tx.order.findUniqueOrThrow({
            where: { id: order.id },
            include: orderDetailInclude,
          });
        });

        return toOrderDetail(updated);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          throw conflict("Order status changed concurrently — refresh and try again");
        }
        throw err;
      }
    },
    { body: updateOrderDto },
  )

  /**
   * Permanently delete an order — for clearing out test and junk rows.
   *
   * Two things have to happen before the row goes, or the books stop matching
   * the warehouse:
   *
   * 1. **Give the stock back.** A Processing/Confirmed/On-the-way order holds
   *    `reserved` units; a Delivered one has already consumed physical stock
   *    and counted toward `sold`. Deleting the row alone would strand those
   *    numbers forever — the product would show fewer available units than it
   *    has, with no order left to explain why. Running the same
   *    Cancelled transition the status route uses unwinds whichever case
   *    applies and writes the StockMovement that accounts for it.
   *
   * 2. **Let the cascades run.** OrderItem, OrderEvent, Invoice and Warranty
   *    are all `onDelete: Cascade`, so the invoice and any warranty records
   *    for this order go with it. That is a real loss of history, which is why
   *    the admin asks first and spells out what will disappear.
   *
   * `preparedById` is SetNull, so deleting never touches a staff row.
   */
  .delete("/admin/api/orders/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "orders", "manage");

    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: params.id },
        include: { items: true },
      });
      if (!order) throw notFound("Order");

      const from = parseOrderStatus(order.status);
      // Cancelled orders already hold no claim on stock, so this is a no-op
      // for them (applyStatusTransition returns early when the state matches).
      await applyStatusTransition(tx, order, from, "Cancelled", staffCtx.staff.username);

      await tx.order.delete({ where: { id: order.id } });
      return { ok: true, id: order.id };
    });
  });
