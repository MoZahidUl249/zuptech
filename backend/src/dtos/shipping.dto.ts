import { t } from "elysia";
import { courierKindDto, paymentEnvironmentDto, shipmentStatusDto } from "./common";

/**
 * Couriers and shipments.
 *
 * The courier shape mirrors `payments.dto.ts` on purpose — same credential
 * discipline (write-only, a mask means "keep stored"), same enable and
 * environment switches. One pattern to learn, not two.
 */

const courierFields = {
  name: t.String({ minLength: 2, maxLength: 100 }),
  kind: courierKindDto,
  provider: t.String({ maxLength: 100 }),
  enabled: t.Boolean(),
  environment: paymentEnvironmentDto,
  /** `{code}` is replaced with the tracking code when shown to a customer. */
  trackingUrl: t.String({ maxLength: 300 }),
};

/** Steadfast needs two; the shape is open for the next provider's three. */
export const courierCredentialsDto = t.Object({
  apiKey: t.Optional(t.String({ maxLength: 300 })),
  secretKey: t.Optional(t.String({ maxLength: 300 })),
});

export const createCourierDto = t.Object({
  id: t.String({ minLength: 2, maxLength: 50, pattern: "^[a-z0-9-]+$" }),
  ...courierFields,
  credentials: t.Optional(courierCredentialsDto),
});

export const updateCourierDto = t.Partial(
  t.Object({ ...courierFields, credentials: courierCredentialsDto }),
);

/**
 * Book an order onto a courier.
 *
 * `consignmentId` / `trackingCode` are for a **manual** courier, where the
 * numbers come off a paper slip and there is no API to ask. An API courier
 * ignores them — whatever it returns is the truth, and letting staff type a
 * consignment id that the courier never issued would make tracking lie.
 */
export const createShipmentDto = t.Object({
  courierId: t.String({ minLength: 1, maxLength: 50 }),
  riderId: t.Optional(t.Nullable(t.String({ maxLength: 40 }))),
  consignmentId: t.Optional(t.String({ maxLength: 100 })),
  trackingCode: t.Optional(t.String({ maxLength: 100 })),
  note: t.Optional(t.String({ maxLength: 300 })),
});

/** Move a shipment by hand — the only way for self and manual couriers. */
export const updateShipmentDto = t.Partial(
  t.Object({
    status: shipmentStatusDto,
    riderId: t.Nullable(t.String({ maxLength: 40 })),
    consignmentId: t.String({ maxLength: 100 }),
    trackingCode: t.String({ maxLength: 100 }),
    note: t.String({ maxLength: 300 }),
  }),
);

export type CreateCourierDto = typeof createCourierDto.static;
export type UpdateCourierDto = typeof updateCourierDto.static;
export type CreateShipmentDto = typeof createShipmentDto.static;
export type UpdateShipmentDto = typeof updateShipmentDto.static;
