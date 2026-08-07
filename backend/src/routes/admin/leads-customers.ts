import { Elysia } from "elysia";
import {
  listCustomersQueryDto,
  listIndustrialLeadsQueryDto,
  listLeadsQueryDto,
  updateContactMessageDto,
  updateIndustrialLeadStatusDto,
  updateLeadStatusDto,
} from "../../dtos/leads.dto";
import { prisma } from "../../lib/db";
import { LIST_CAP } from "../../lib/rules";
import { notFound } from "../../lib/http";
import { assertCan } from "../../lib/rbac";
import { toCustomer, toIndustrialLead, toLead, toMessage } from "../../lib/serialize";
import { staffGuard } from "./guard";

export const adminLeadsCustomers = new Elysia({ name: "routes/admin/leads-customers", detail: { tags: ["Admin · Leads & Customers"] } })
  .use(staffGuard)

  /* ===== Service leads ===== */

  .get(
    "/admin/api/leads",
    async ({ query, staffCtx }) => {
      assertCan(staffCtx, "leads", "view");
      const leads = await prisma.serviceLead.findMany({
        take: LIST_CAP,
        where: query.status ? { status: query.status } : undefined,
        orderBy: { createdAt: "desc" },
        include: { service: true },
      });
      return leads.map(toLead);
    },
    { query: listLeadsQueryDto },
  )

  .patch(
    "/admin/api/leads/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "leads", "manage");
      const existing = await prisma.serviceLead.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Lead");
      const lead = await prisma.serviceLead.update({
        where: { id: params.id },
        data: { status: body.status },
        include: { service: true },
      });
      return toLead(lead);
    },
    { body: updateLeadStatusDto },
  )

  .delete("/admin/api/leads/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "leads", "manage");
    const existing = await prisma.serviceLead.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound("Lead");
    await prisma.serviceLead.delete({ where: { id: params.id } });
    return { ok: true };
  })

  /* ===== Industrial leads =====
   *
   * Separate endpoints rather than a `type` filter on /admin/api/leads: the
   * payload, the status vocabulary and the admin screen all differ, and
   * merging them would force every consumer to narrow a union. Gated on the
   * same "leads" module so no role permission migration is needed. */

  .get(
    "/admin/api/industrial-leads",
    async ({ query, staffCtx }) => {
      assertCan(staffCtx, "leads", "view");
      const leads = await prisma.industrialLead.findMany({
        take: LIST_CAP,
        where: {
          ...(query.status ? { status: query.status } : {}),
          ...(query.sector ? { sector: query.sector } : {}),
        },
        orderBy: { createdAt: "desc" },
      });
      return leads.map(toIndustrialLead);
    },
    { query: listIndustrialLeadsQueryDto },
  )

  .patch(
    "/admin/api/industrial-leads/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "leads", "manage");
      const existing = await prisma.industrialLead.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Industrial lead");
      const lead = await prisma.industrialLead.update({
        where: { id: params.id },
        data: { status: body.status },
      });
      return toIndustrialLead(lead);
    },
    { body: updateIndustrialLeadStatusDto },
  )

  .delete("/admin/api/industrial-leads/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "leads", "manage");
    const existing = await prisma.industrialLead.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound("Industrial lead");
    await prisma.industrialLead.delete({ where: { id: params.id } });
    return { ok: true };
  })

  /* ===== Customers ===== */

  .get(
    "/admin/api/customers",
    async ({ query, staffCtx }) => {
      assertCan(staffCtx, "customers", "view");
      const q = query.q?.trim();
      const customers = await prisma.customer.findMany({
        take: LIST_CAP,
        where: q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { phone: { contains: q.replace(/[\s-]/g, "") } },
              ],
            }
          : undefined,
        include: { _count: { select: { orders: true } } },
        orderBy: { joinedAt: "desc" },
      });
      return customers.map(toCustomer);
    },
    { query: listCustomersQueryDto },
  )

  /* ===== Contact-form messages ===== */

  .get("/admin/api/messages", async ({ staffCtx }) => {
    assertCan(staffCtx, "leads", "view");
    const messages = await prisma.contactMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return messages.map(toMessage);
  })

  .patch(
    "/admin/api/messages/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "leads", "manage");
      const existing = await prisma.contactMessage.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Message");
      const message = await prisma.contactMessage.update({ where: { id: params.id }, data: body });
      return toMessage(message);
    },
    { body: updateContactMessageDto },
  )

  .delete("/admin/api/messages/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "leads", "manage");
    const existing = await prisma.contactMessage.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound("Message");
    await prisma.contactMessage.delete({ where: { id: params.id } });
    return { ok: true };
  });
