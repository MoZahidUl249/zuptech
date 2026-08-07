import { Elysia } from "elysia";
import {
  createInvoiceDto,
  listInvoicesQueryDto,
  updateInvoiceDto,
} from "../../dtos/invoices.dto";
import { prisma } from "../../lib/db";
import { LIST_CAP } from "../../lib/rules";
import { conflict, notFound } from "../../lib/http";
import { logOrderEvent } from "../../lib/order-events";
import { nextId } from "../../lib/ids";
import { assertCan } from "../../lib/rbac";
import { toInvoice } from "../../lib/serialize";
import { staffGuard } from "./guard";

/** Relations `toInvoice` needs — the document is rendered from the order. */
const invoiceInclude = {
  issuedBy: true,
  order: {
    include: {
      items: { include: { product: { select: { name: true, sku: true, slug: true } } } },
      preparedBy: true,
    },
  },
};

export const adminInvoices = new Elysia({
  name: "routes/admin/invoices",
  detail: { tags: ["Admin · Invoices"] },
})
  .use(staffGuard)

  .get(
    "/admin/api/invoices",
    async ({ query, staffCtx }) => {
      assertCan(staffCtx, "invoices", "view");

      const q = query.q?.trim();
      const invoices = await prisma.invoice.findMany({
        take: LIST_CAP,
        where: {
          ...(query.status ? { status: query.status } : {}),
          ...(q
            ? {
                OR: [
                  { id: { contains: q, mode: "insensitive" } },
                  { orderId: { contains: q, mode: "insensitive" } },
                  { order: { name: { contains: q, mode: "insensitive" } } },
                  { order: { phone: { contains: q.replace(/[\s-]/g, "") } } },
                ],
              }
            : {}),
        },
        include: invoiceInclude,
        orderBy: { number: "desc" },
      });
      return invoices.map(toInvoice);
    },
    { query: listInvoicesQueryDto },
  )

  .get("/admin/api/invoices/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "invoices", "view");

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: invoiceInclude,
    });
    if (!invoice) throw notFound("Invoice");
    return toInvoice(invoice);
  })

  /** Raise a Draft invoice against an existing order. One per order. */
  .post(
    "/admin/api/invoices",
    async ({ body, staffCtx, set }) => {
      assertCan(staffCtx, "invoices", "manage");

      const order = await prisma.order.findUnique({
        where: { id: body.orderId },
        select: { id: true, invoice: { select: { id: true } } },
      });
      if (!order) throw notFound("Order");
      if (order.invoice) {
        throw conflict(`Order ${order.id} already has invoice ${order.invoice.id}`);
      }

      const invoice = await prisma.$transaction(async (tx) => {
        const { id, number } = await nextId(tx, "invoice");
        const created = await tx.invoice.create({
          data: {
            id,
            number,
            orderId: order.id,
            notes: body.notes ?? "",
          },
          include: invoiceInclude,
        });
        await logOrderEvent(tx, order.id, "invoice", `Invoice ${id} created`, staffCtx);
        return created;
      });

      set.status = 201;
      return toInvoice(invoice);
    },
    { body: createInvoiceDto },
  )

  /**
   * Status/notes change. Issued and Paid stamp their timestamps the first time
   * they are reached and keep them afterwards — an invoice that was issued on
   * the 3rd is still an invoice issued on the 3rd after it is paid. There is
   * deliberately no DELETE: a raised invoice is voided, never erased.
   */
  .patch(
    "/admin/api/invoices/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "invoices", "manage");

      const existing = await prisma.invoice.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Invoice");

      const now = new Date();
      const statusChanged = body.status !== undefined && body.status !== existing.status;

      const updated = await prisma.$transaction(async (tx) => {
        const saved = await tx.invoice.update({
          where: { id: existing.id },
          data: {
            ...(body.status !== undefined ? { status: body.status } : {}),
            ...(body.notes !== undefined ? { notes: body.notes } : {}),
            ...(body.status === "Issued" && !existing.issuedAt
              ? { issuedAt: now, issuedById: staffCtx.staff.id }
              : {}),
            ...(body.status === "Paid" && !existing.paidAt ? { paidAt: now } : {}),
          },
          include: invoiceInclude,
        });

        if (statusChanged) {
          await logOrderEvent(
            tx,
            existing.orderId,
            "invoice",
            `Invoice ${existing.id} ${existing.status} → ${body.status}`,
            staffCtx,
          );
        }
        return saved;
      });

      return toInvoice(updated);
    },
    { body: updateInvoiceDto },
  );
