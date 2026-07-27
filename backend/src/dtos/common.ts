import { t } from "elysia";
import {
  INDUSTRIAL_LEAD_STATUSES,
  INDUSTRIAL_SCOPES,
  INDUSTRIAL_SECTORS,
  INDUSTRIAL_TIMELINES,
  INVOICE_STATUSES,
  LEAD_STATUSES,
  ORDER_STATUSES,
  WARRANTY_STATUSES,
} from "../lib/rules";

/**
 * Shared DTO building blocks. Every route body/query schema lives in
 * `src/dtos/*` so the API contract is declared in one place, handlers receive
 * fully-typed payloads, and Elysia validates them at runtime before any
 * business code runs. Vocabularies derive from lib/rules.ts — never restate
 * the literals here.
 */

/**
 * Cart lines as clients may send them: ids + quantities ONLY. Any price,
 * total, or fee field a client adds is ignored — money is always recomputed
 * from the catalog (cal-bk.md §3). Caps: 50 lines, qty 1–99.
 */
export const cartItemsDto = t.Array(
  t.Object({
    productId: t.String({ minLength: 1 }),
    qty: t.Integer({ minimum: 1, maximum: 99 }),
  }),
  { minItems: 1, maxItems: 50 },
);

/** Same shape as cartItemsDto, but an empty array is valid — a saved cart
 *  can be cleared out, unlike a checkout submission. */
export const savedCartItemsDto = t.Array(
  t.Object({
    productId: t.String({ minLength: 1 }),
    qty: t.Integer({ minimum: 1, maximum: 99 }),
  }),
  { maxItems: 50 },
);

export const orderStatusDto = t.Union(ORDER_STATUSES.map((s) => t.Literal(s)));
export const leadStatusDto = t.Union(LEAD_STATUSES.map((s) => t.Literal(s)));
export const invoiceStatusDto = t.Union(INVOICE_STATUSES.map((s) => t.Literal(s)));
export const warrantyStatusDto = t.Union(WARRANTY_STATUSES.map((s) => t.Literal(s)));

export const industrialLeadStatusDto = t.Union(
  INDUSTRIAL_LEAD_STATUSES.map((s) => t.Literal(s)),
);
export const industrialSectorDto = t.Union(INDUSTRIAL_SECTORS.map((s) => t.Literal(s)));
export const industrialScopeDto = t.Union(INDUSTRIAL_SCOPES.map((s) => t.Literal(s)));
export const industrialTimelineDto = t.Union(INDUSTRIAL_TIMELINES.map((s) => t.Literal(s)));

/** Slugs are the storefront-visible identifier for services and categories. */
export const slugDto = t.String({
  minLength: 1,
  maxLength: 120,
  pattern: "^[a-z0-9]+(-[a-z0-9]+)*$",
});

export type OrderStatusDto = typeof orderStatusDto.static;
export type LeadStatusDto = typeof leadStatusDto.static;
export type InvoiceStatusDto = typeof invoiceStatusDto.static;
export type WarrantyStatusDto = typeof warrantyStatusDto.static;
export type IndustrialLeadStatusDto = typeof industrialLeadStatusDto.static;
export type IndustrialSectorDto = typeof industrialSectorDto.static;
export type IndustrialScopeDto = typeof industrialScopeDto.static;
export type IndustrialTimelineDto = typeof industrialTimelineDto.static;
