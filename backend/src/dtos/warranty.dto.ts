import { t } from "elysia";
import { warrantyStatusDto } from "./common";

/**
 * Warranty rows are generated from delivered order lines, never authored by
 * hand — so the create payload is just the order to generate from (used for
 * orders delivered before the registry existed).
 */
export const generateWarrantiesDto = t.Object({
  orderId: t.String({ minLength: 1, maxLength: 40 }),
});

export const listWarrantiesQueryDto = t.Object({
  q: t.Optional(t.String()),
  status: t.Optional(warrantyStatusDto),
});

export const updateWarrantyDto = t.Object({
  serialNo: t.Optional(t.String({ maxLength: 400 })),
  status: t.Optional(warrantyStatusDto),
  claimNote: t.Optional(t.String({ maxLength: 1000 })),
  /** Changing the period re-derives endsAt from the original start date. */
  months: t.Optional(t.Integer({ minimum: 0, maximum: 240 })),
});

export type GenerateWarrantiesDto = typeof generateWarrantiesDto.static;
export type ListWarrantiesQueryDto = typeof listWarrantiesQueryDto.static;
export type UpdateWarrantyDto = typeof updateWarrantyDto.static;
