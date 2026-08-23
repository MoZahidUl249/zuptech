import { Elysia } from "elysia";
import { listOrdersQueryDto, updateOrderDto } from "../../dtos/orders.dto";
import { Prisma } from "../../generated/client";
import { prisma } from "../../lib/db";
import { badRequest, conflict, notFound } from "../../lib/http";
import { logOrderEvent } from "../../lib/order-events";
import { applyStatusTransition } from "../../lib/order-stock";
import { repriceOrderForZone } from "../../lib/pricing";
import { assertCan } from "../../lib/rbac";
import { parseOrderStatus, LIST_CAP } from "../../lib/rules";
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
        take: LIST_CAP,
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
        /*
         * Newest first by TIME, not by counter.
         *
         * `number` is a surrogate the Counter hands out, and sorting on it only
         * means "newest" while that counter has always been the sole source of
         * these rows. It stops being true the moment any row arrives with a
         * number from somewhere else — an import, a migration, a restored
         * backup, or a seeded fixture — and then the newest real row sorts
         * BELOW the imported block and falls off the end of LIST_CAP entirely.
         * That is not hypothetical: it hid a just-issued warranty behind 799
         * fixture rows numbered from 900000.
         *
         * In production the two orderings are identical, so this costs nothing
         * and removes the assumption.
         */
        orderBy: { createdAt: "desc" },
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

      /* Correcting a placed order's money is a different act from advancing
         its status, and is gated separately — see ADMIN_MODULES in rbac.ts. */
      const touchesMoney = body.insideDhaka !== undefined || body.adjust !== undefined;
      if (touchesMoney) assertCan(staffCtx, "orderadjust", "manage");

      if (
        body.status === undefined &&
        body.preparedById === undefined &&
        !touchesMoney
      ) {
        throw badRequest(
          "Nothing to update — send status, preparedById, insideDhaka and/or adjust",
        );
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

          /*
           * Zone correction and/or a manual override.
           *
           * Both rewrite money on a placed order, so they are refused once an
           * invoice has left the building: Invoice stores no amounts of its
           * own and derives every figure from this row (serialize.ts
           * toInvoice), so editing here would silently restate a document the
           * customer is already holding. Void it or keep it in Draft first.
           */
          if (touchesMoney) {
            const invoice = await tx.invoice.findUnique({
              where: { orderId: order.id },
              select: { id: true, status: true },
            });
            if (invoice && (invoice.status === "Issued" || invoice.status === "Paid")) {
              throw badRequest(
                `Invoice ${invoice.id} is ${invoice.status} and takes its amounts from this order — void it before changing the charges`,
              );
            }
          }

          if (body.insideDhaka !== undefined && body.insideDhaka !== order.insideDhaka) {
            const priced = await repriceOrderForZone(
              order.items.map((i) => ({
                productId: i.productId,
                qty: i.qty,
                unitPrice: i.unitPrice,
              })),
              body.insideDhaka,
            );
            // The goods must not move. If they did, something repriced the
            // catalogue instead of the zone, and the customer would be billed
            // for a change they never agreed to.
            if (priced.subtotal !== order.subtotal) {
              throw badRequest(
                "Re-pricing changed the goods total — refusing. This is a bug, not a data problem.",
              );
            }

            const wasLabel = order.insideDhaka ? "Inside Dhaka" : "Outside Dhaka";
            const nowLabel = body.insideDhaka ? "Inside Dhaka" : "Outside Dhaka";

            data.insideDhaka = body.insideDhaka;
            data.deliveryFee = priced.deliveryFee;
            data.installationFee = priced.installationFee;
            data.total = priced.total;
            /* The zone is also baked into the address string at checkout
               (public/orders.ts), so correcting the column alone would leave
               the address contradicting it on every screen and invoice. */
            data.address = order.address.endsWith(`, ${wasLabel}`)
              ? `${order.address.slice(0, -`, ${wasLabel}`.length)}, ${nowLabel}`
              : `${order.address}, ${nowLabel}`;

            // Per-unit snapshots move too, or the line rows stop adding up to
            // the order totals shown beside them.
            for (const line of priced.lines) {
              await tx.orderItem.updateMany({
                where: { orderId: order.id, productId: line.productId },
                data: { deliveryFee: line.deliveryFee, installationFee: line.installationFee },
              });
            }

            await logOrderEvent(
              tx,
              order.id,
              "note",
              `Delivery zone ${wasLabel} → ${nowLabel} · delivery ${order.deliveryFee} → ${priced.deliveryFee}` +
                ` · installation ${order.installationFee} → ${priced.installationFee}` +
                ` · total ${order.total} → ${priced.total}`,
              staffCtx,
            );
          }

          if (body.adjust) {
            const nextDelivery = body.adjust.deliveryFee ?? (data.deliveryFee as number | undefined) ?? order.deliveryFee;
            const nextInstall =
              body.adjust.installationFee ?? (data.installationFee as number | undefined) ?? order.installationFee;
            const nextTotal = order.subtotal + nextDelivery + nextInstall;

            data.deliveryFee = nextDelivery;
            data.installationFee = nextInstall;
            data.total = nextTotal;

            await logOrderEvent(
              tx,
              order.id,
              "note",
              `Charges adjusted by hand · delivery ${order.deliveryFee} → ${nextDelivery}` +
                ` · installation ${order.installationFee} → ${nextInstall}` +
                ` · total ${order.total} → ${nextTotal} · reason: ${body.adjust.reason}`,
              staffCtx,
            );
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
