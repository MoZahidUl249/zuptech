import { t } from "elysia";
import { invoiceStatusDto } from "./common";

/**
 * Invoices carry no money of their own — the amounts are derived from the
 * order they belong to, whose totals were frozen at checkout. So creating one
 * needs nothing but the order id.
 */
export const createInvoiceDto = t.Object({
  orderId: t.String({ minLength: 1, maxLength: 40 }),
  notes: t.Optional(t.String({ maxLength: 500 })),
});

export const listInvoicesQueryDto = t.Object({
  q: t.Optional(t.String()),
  status: t.Optional(invoiceStatusDto),
});

export const updateInvoiceDto = t.Object({
  status: t.Optional(invoiceStatusDto),
  notes: t.Optional(t.String({ maxLength: 500 })),
});

export type CreateInvoiceDto = typeof createInvoiceDto.static;
export type ListInvoicesQueryDto = typeof listInvoicesQueryDto.static;
export type UpdateInvoiceDto = typeof updateInvoiceDto.static;
