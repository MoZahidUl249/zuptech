import { t } from "elysia";
import type { TLiteral, TUnion } from "@sinclair/typebox";
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

/**
 * Builds a literal union from one of lib/rules.ts's `as const` vocabularies.
 *
 * The obvious `t.Union(VALUES.map((s) => t.Literal(s)))` validates correctly at
 * runtime but is a TYPE-level trap: `.map()` on a readonly tuple returns a
 * plain `TLiteral<string>[]`, and `t.Union` can only infer a union from a
 * TUPLE — given an array it collapses the static type to `never`. Every DTO
 * built that way (order/lead/invoice/warranty status, industrial
 * sector/scope/timeline) silently typed its field as `never`, so handlers and
 * clients got no checking at all on exactly the fields with a fixed
 * vocabulary. The mapped-tuple assertion below keeps the per-element literal
 * types, so the inferred static type is the real union.
 */
function literalUnion<const T extends readonly [string, ...string[]]>(
  values: T,
): TUnion<{ -readonly [K in keyof T]: TLiteral<T[K] & string> }> {
  // The runtime value is the same union schema as before; only the declared
  // return type differs, and that is the entire point — inference has to be
  // stated here because t.Union cannot recover it from a mapped array.
  return t.Union(values.map((value) => t.Literal(value)) as never) as never;
}

export const orderStatusDto = literalUnion(ORDER_STATUSES);
export const leadStatusDto = literalUnion(LEAD_STATUSES);
export const invoiceStatusDto = literalUnion(INVOICE_STATUSES);
export const warrantyStatusDto = literalUnion(WARRANTY_STATUSES);

export const industrialLeadStatusDto = literalUnion(INDUSTRIAL_LEAD_STATUSES);
export const industrialSectorDto = literalUnion(INDUSTRIAL_SECTORS);
export const industrialScopeDto = literalUnion(INDUSTRIAL_SCOPES);
export const industrialTimelineDto = literalUnion(INDUSTRIAL_TIMELINES);

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
