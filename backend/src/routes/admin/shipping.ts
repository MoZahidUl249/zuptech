import { Elysia } from "elysia";
import {
  createCourierDto,
  createShipmentDto,
  updateCourierDto,
  updateShipmentDto,
} from "../../dtos/shipping.dto";
import type { Prisma } from "../../generated/client";
import { prisma } from "../../lib/db";
import type { Tx } from "../../lib/db";
import { badRequest, conflict, notFound } from "../../lib/http";
import { logOrderEvent } from "../../lib/order-events";
import { setOrderStatus } from "../../lib/order-status";
import { assertCan } from "../../lib/rbac";
import type { StaffContext } from "../../lib/rbac";
import {
  coerceTo,
  isMaskedSecret,
  PAYMENT_ENVIRONMENTS,
  type ShipmentStatus,
} from "../../lib/rules";
import { toCourier, toShipment } from "../../lib/serialize";
import { notify, orderDeliveredSms, orderShippedSms } from "../../lib/sms";
import { adapterFor } from "../../lib/shipping";
import { ORDER_STATUS_FOR } from "../../lib/shipping/types";
import { staffGuard } from "./guard";

/**
 * Fulfilment: which couriers exist, and where each order's parcel is.
 *
 * Gated on `shipping`, not `orders`. Handing a customer's name, phone and
 * address to a third party is a different act from advancing a status, and
 * courier credentials sit behind this module exactly as gateway credentials
 * sit behind `payments`.
 */

/** Relations the shipment mappers need loaded. */
const shipmentInclude = {
  courier: { select: { name: true, kind: true, trackingUrl: true, provider: true } },
  rider: { select: { id: true, name: true } },
  events: { orderBy: { at: "desc" as const } },
};

/** A courier's reply, stored verbatim — it came out of JSON.parse. */
const asJson = (value: Record<string, unknown>) => value as Prisma.InputJsonObject;

/** Same "a mask means unchanged" rule as payment credentials. */
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

async function logShipmentEvent(
  tx: Tx,
  shipmentId: string,
  kind: string,
  detail: string,
  ctx: StaffContext | null,
): Promise<void> {
  await tx.shipmentEvent.create({
    data: {
      shipmentId,
      kind,
      detail,
      by: ctx?.staff.username ?? "system",
      byName: ctx?.staff.name ?? "System",
    },
  });
}

/**
 * A shipment status change, and what it means for the order.
 *
 * Delivery is the case worth being careful about: it consumes stock and starts
 * warranty cover, so it goes through `setOrderStatus` — the same path the
 * admin panel and the payment gateway use — rather than writing the order's
 * status column here. `ORDER_STATUS_FOR` returning null means the order is
 * deliberately left alone (a returned parcel is a decision for a human).
 */
async function applyShipmentStatus(
  tx: Tx,
  shipment: { id: string; orderId: string; status: string },
  to: ShipmentStatus,
  ctx: StaffContext | null,
  actorUsername: string,
): Promise<void> {
  if (shipment.status === to) return;

  await tx.shipment.update({ where: { id: shipment.id }, data: { status: to } });
  await logShipmentEvent(tx, shipment.id, "status", `${shipment.status} → ${to}`, ctx);

  const orderStatus = ORDER_STATUS_FOR[to];
  if (!orderStatus) return;

  const moved = await setOrderStatus(tx, shipment.orderId, orderStatus, actorUsername);
  if (moved) {
    await logOrderEvent(
      tx,
      shipment.orderId,
      "note",
      `Shipment ${to.toLowerCase()} — order moved to ${orderStatus}`,
      ctx,
    );
  }
}

export const adminShipping = new Elysia({
  name: "routes/admin/shipping",
  detail: { tags: ["Admin · Shipping"] },
})
  .use(staffGuard)

  /* ===== Couriers ===== */

  .get("/admin/api/couriers", async ({ staffCtx }) => {
    assertCan(staffCtx, "shipping", "view");
    const couriers = await prisma.courier.findMany({
      orderBy: { sort: "asc" },
      include: { _count: { select: { shipments: true } } },
    });
    return couriers.map(toCourier);
  })

  .post(
    "/admin/api/couriers",
    async ({ body, staffCtx, set }) => {
      assertCan(staffCtx, "shipping", "manage");

      const clash = await prisma.courier.findUnique({ where: { id: body.id } });
      if (clash) throw conflict(`Courier "${body.id}" already exists`);

      const sort = await prisma.courier.count();
      const { credentials, ...rest } = body;
      const courier = await prisma.courier.create({
        data: { ...rest, sort, ...(credentials ? { credentials } : {}) },
      });
      set.status = 201;
      return toCourier(courier);
    },
    { body: createCourierDto },
  )

  .put(
    "/admin/api/couriers/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "shipping", "manage");

      const existing = await prisma.courier.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Courier");

      const { credentials, ...rest } = body;
      const courier = await prisma.courier.update({
        where: { id: params.id },
        data: {
          ...rest,
          ...(credentials
            ? { credentials: mergeCredentials(existing.credentials, credentials) }
            : {}),
        },
      });
      return toCourier(courier);
    },
    { body: updateCourierDto },
  )

  .delete("/admin/api/couriers/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "shipping", "manage");

    const existing = await prisma.courier.findUnique({
      where: { id: params.id },
      include: { _count: { select: { shipments: true } } },
    });
    if (!existing) throw notFound("Courier");

    /* Deleting a courier that has carried parcels would take the delivery
       history of those orders with it — the Shipment rows are what say how a
       customer's order reached them. Disable it instead; it then stops
       appearing as a choice while the past stays readable. */
    if (existing._count.shipments > 0) {
      throw conflict(
        `${existing.name} has ${existing._count.shipments} shipment(s) — disable it instead of deleting, so the delivery history survives`,
      );
    }

    await prisma.courier.delete({ where: { id: params.id } });
    return { ok: true };
  })

  /* ===== Shipments ===== */

  /**
   * Hand an order to a courier.
   *
   * For an API courier this actually books the parcel; for self-delivery and
   * manual couriers it records the decision. Either way the order gains a
   * shipment, and the audit trail says who did it.
   */
  .post(
    "/admin/api/orders/:id/shipment",
    async ({ params, body, staffCtx, set }) => {
      assertCan(staffCtx, "shipping", "manage");

      const order = await prisma.order.findUnique({
        where: { id: params.id },
        include: { shipment: true, payments: true },
      });
      if (!order) throw notFound("Order");
      if (order.shipment) {
        throw conflict(`Order ${order.id} is already on a courier`);
      }
      if (order.status === "Cancelled") {
        throw badRequest("A cancelled order cannot be shipped");
      }

      const courier = await prisma.courier.findUnique({ where: { id: body.courierId } });
      if (!courier) throw notFound("Courier");
      if (!courier.enabled) throw badRequest(`${courier.name} is disabled`);

      // A rider only means something for our own delivery.
      let riderName: string | null = null;
      if (body.riderId) {
        if (courier.kind !== "self") {
          throw badRequest("Only a self-delivery courier can be assigned a rider");
        }
        const rider = await prisma.staff.findUnique({
          where: { id: body.riderId },
          select: { name: true },
        });
        if (!rider) throw notFound("Staff member");
        riderName = rider.name;
      }

      /*
       * What the rider collects at the door.
       *
       * Zero when the order was already paid online. Sending the order total
       * to a courier for a prepaid order charges the customer a second time,
       * and the courier has no way of knowing better — it collects what it is
       * told to collect.
       */
      const prepaid = order.payments.some((p) => p.status === "Paid");
      const codAmount = prepaid ? 0 : order.total;

      const adapter = adapterFor(courier.kind, courier.provider);

      let consignmentId = body.consignmentId?.trim() ?? "";
      let trackingCode = body.trackingCode?.trim() ?? "";
      let status: ShipmentStatus = "Booked";
      let raw: Record<string, unknown> = {};

      if (adapter) {
        // The courier's own numbers win: a consignment id typed by hand that
        // the courier never issued makes every later status query lie.
        const booked = await adapter.book(
          {
            credentials: (courier.credentials ?? {}) as Record<string, string>,
            environment: coerceTo(PAYMENT_ENVIRONMENTS, courier.environment, "Test"),
          },
          {
            orderId: order.id,
            recipientName: order.name,
            recipientPhone: order.phone,
            recipientAddress: order.address,
            codAmount,
            note: body.note ?? "",
          },
        );
        consignmentId = booked.consignmentId;
        trackingCode = booked.trackingCode;
        status = booked.status;
        raw = booked.raw;
      }

      /*
       * From here the parcel may already exist at the courier.
       *
       * The API call above deliberately runs OUTSIDE the transaction — a
       * network round trip inside one holds a row lock for its whole duration,
       * and a slow courier would then block everything touching that order.
       * The cost is this window: booked with them, not yet recorded with us.
       * It cannot be closed, only made loud, so a failure here prints the
       * consignment id at error level and says what to do about it.
       */
      const shipment = await prisma
        .$transaction(async (tx) => {
        const created = await tx.shipment.create({
          data: {
            orderId: order.id,
            courierId: courier.id,
            consignmentId,
            trackingCode,
            status,
            codAmount,
            riderId: body.riderId ?? null,
            note: body.note ?? "",
            raw: asJson(raw),
          },
        });

        await logShipmentEvent(
          tx,
          created.id,
          "booked",
          `Booked with ${courier.name}` +
            (consignmentId ? ` · consignment ${consignmentId}` : "") +
            (riderName ? ` · rider ${riderName}` : "") +
            ` · COD ৳${codAmount}`,
          staffCtx,
        );
        await logOrderEvent(
          tx,
          order.id,
          "note",
          `Handed to ${courier.name}` + (trackingCode ? ` · tracking ${trackingCode}` : ""),
          staffCtx,
        );

        /*
         * Confirm in the same transaction as the booking.
         *
         * This is what makes "Confirm & hand to courier" one act rather than
         * two: either the order is confirmed AND has a courier, or neither
         * happened. A confirmed order with nothing carrying it is precisely
         * the state this flow exists to make unreachable.
         *
         * Only ever forward from Processing. An order already Confirmed (by a
         * payment, say) is left where it is — `setOrderStatus` is a no-op when
         * the status already matches, but being explicit here keeps a late
         * booking from looking like it re-confirmed anything.
         */
        if (body.confirm && order.status === "Processing") {
          await setOrderStatus(tx, order.id, "Confirmed", staffCtx.staff.username);
          await logOrderEvent(tx, order.id, "status", "Processing → Confirmed", staffCtx);
        }

        return tx.shipment.findUniqueOrThrow({
          where: { id: created.id },
          include: shipmentInclude,
        });
        })
        .catch((err: unknown) => {
          if (adapter && consignmentId) {
            console.error(
              `[shipping] BOOKED BUT NOT RECORDED — ${courier.name} consignment ${consignmentId} ` +
                `exists for order ${order.id}, and writing it here failed. Cancel it with the ` +
                `courier or attach it by hand; the customer's parcel is real either way.`,
              err,
            );
          }
          throw err;
        });

      /* After the transaction, for the reason given in public/orders.ts:
         a send inside one holds locks, and a rollback cannot unsend. */
      void notify(
        "shipped",
        order.phone,
        orderShippedSms(order.id, courier.name, shipment.trackingCode),
      );

      set.status = 201;
      return toShipment(shipment);
    },
    { body: createShipmentDto },
  )

  .get("/admin/api/orders/:id/shipment", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "shipping", "view");
    const shipment = await prisma.shipment.findUnique({
      where: { orderId: params.id },
      include: shipmentInclude,
    });
    if (!shipment) throw notFound("Shipment");
    return toShipment(shipment);
  })

  /** Move a shipment by hand — the only way for self and manual couriers. */
  .patch(
    "/admin/api/shipments/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "shipping", "manage");

      const shipment = await prisma.shipment.findUnique({
        where: { id: params.id },
        include: {
          courier: { select: { kind: true, name: true } },
          // The customer's number, for the delivered message below.
          order: { select: { phone: true } },
        },
      });
      if (!shipment) throw notFound("Shipment");

      if (body.riderId !== undefined && body.riderId && shipment.courier.kind !== "self") {
        throw badRequest("Only a self-delivery courier can be assigned a rider");
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (body.status !== undefined) {
          await applyShipmentStatus(
            tx,
            shipment,
            body.status,
            staffCtx,
            staffCtx.staff.username,
          );
        }

        const rest = {
          ...(body.riderId !== undefined ? { riderId: body.riderId } : {}),
          ...(body.consignmentId !== undefined ? { consignmentId: body.consignmentId } : {}),
          ...(body.trackingCode !== undefined ? { trackingCode: body.trackingCode } : {}),
          ...(body.note !== undefined ? { note: body.note } : {}),
        };
        if (Object.keys(rest).length > 0) {
          await tx.shipment.update({ where: { id: shipment.id }, data: rest });
          if (body.riderId !== undefined) {
            const rider = body.riderId
              ? await tx.staff.findUnique({
                  where: { id: body.riderId },
                  select: { name: true },
                })
              : null;
            await logShipmentEvent(
              tx,
              shipment.id,
              "rider",
              `Rider set to ${rider?.name ?? "nobody"}`,
              staffCtx,
            );
          }
        }

        return tx.shipment.findUniqueOrThrow({
          where: { id: shipment.id },
          include: shipmentInclude,
        });
      });

      /* Only on the transition, not on every save of an already-delivered
         shipment — otherwise editing a note would text the customer again. */
      if (body.status === "Delivered" && shipment.status !== "Delivered") {
        void notify("delivered", shipment.order.phone, orderDeliveredSms(shipment.orderId));
      }

      return toShipment(updated);
    },
    { body: updateShipmentDto },
  )

  /**
   * Ask the courier where the parcel is.
   *
   * A courier with no opinion (`null`) leaves the shipment exactly where it
   * was — "no update yet" and "not moving" are different facts, and only one
   * of them is worth writing down.
   */
  .post("/admin/api/shipments/:id/sync", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "shipping", "manage");

    const shipment = await prisma.shipment.findUnique({
      where: { id: params.id },
      include: { courier: true },
    });
    if (!shipment) throw notFound("Shipment");

    const adapter = adapterFor(shipment.courier.kind, shipment.courier.provider);
    if (!adapter) {
      throw badRequest(
        `${shipment.courier.name} has no tracking integration — move this shipment by hand`,
      );
    }
    if (!shipment.consignmentId) {
      throw badRequest("This shipment has no consignment id to look up");
    }

    const result = await adapter.track(
      {
        credentials: (shipment.courier.credentials ?? {}) as Record<string, string>,
        environment: coerceTo(PAYMENT_ENVIRONMENTS, shipment.courier.environment, "Test"),
      },
      shipment.consignmentId,
    );

    const updated = await prisma.$transaction(async (tx) => {
      if (result) {
        await tx.shipment.update({ where: { id: shipment.id }, data: { raw: asJson(result.raw) } });
        await applyShipmentStatus(
          tx,
          shipment,
          result.status,
          staffCtx,
          shipment.courier.provider || "courier",
        );
      } else {
        await logShipmentEvent(tx, shipment.id, "sync", "Courier had no update", staffCtx);
      }

      return tx.shipment.findUniqueOrThrow({
        where: { id: shipment.id },
        include: shipmentInclude,
      });
    });

    return toShipment(updated);
  });
