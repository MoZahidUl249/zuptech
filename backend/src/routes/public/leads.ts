import { Elysia } from "elysia";
import {
  createContactMessageDto,
  createIndustrialLeadDto,
  createLeadDto,
} from "../../dtos/leads.dto";
import { prisma } from "../../lib/db";
import { ApiError, notFound } from "../../lib/http";
import { allowHit, clientIp } from "../../lib/rate-limit";
import { toIndustrialLead, toLead } from "../../lib/serialize";

/**
 * Service enquiries: the home-service booking form on /services, the
 * industrial enquiry form on /industrial, and the contact form. All are open
 * endpoints with strict payload caps to keep spam manageable.
 *
 * The caps bound how big one submission can be; they say nothing about how
 * many arrive. These are unauthenticated endpoints that write a row each, so
 * they also need a per-IP ceiling — a human fills in a booking form once or
 * twice, not fifty times in ten minutes.
 */

/** Shared by all three forms: submitting is a human action, not a loop. */
function guardSubmissions(request: Request, server: Parameters<typeof clientIp>[1], form: string) {
  const ip = clientIp(request, server);
  if (!allowHit(`${form}-ip:${ip}`, 5, 10 * 60_000)) {
    throw new ApiError(429, "Too many submissions — try again in a few minutes");
  }
}

export const publicLeads = new Elysia({ name: "routes/public/leads", detail: { tags: ["Leads"] } })
  .post(
    "/api/leads",
    async ({ body, set, request, server }) => {
      guardSubmissions(request, server, "lead");

      // The FK would reject an unknown id with a 500 — check first so the
      // booking form gets a clean 404 it can act on.
      const service = await prisma.service.findUnique({ where: { id: body.serviceId } });
      if (!service) throw notFound("Service");

      const lead = await prisma.serviceLead.create({
        data: {
          serviceId: service.id,
          customer: body.customer.trim(),
          address: body.address?.trim() ?? "",
          phone: body.phone?.trim() ?? "",
          email: body.email?.trim() ?? "",
          notes: body.notes?.trim() ?? "",
          status: "New",
        },
        include: { service: true },
      });
      set.status = 201;
      return toLead(lead);
    },
    { body: createLeadDto },
  )

  .post(
    "/api/industrial-leads",
    async ({ body, set, request, server }) => {
      guardSubmissions(request, server, "industrial-lead");

      // Best-effort link, unlike /api/leads which 404s on an unknown service:
      // /industrial can render a static fallback list whose ids have no row
      // behind them, and losing a qualified B2B enquiry to a stale id would be
      // far worse than storing it with only the `serviceName` snapshot.
      const linked = body.industrialServiceId
        ? await prisma.industrialService.findUnique({
            where: { id: body.industrialServiceId },
          })
        : null;

      const lead = await prisma.industrialLead.create({
        data: {
          industrialServiceId: linked?.id ?? null,
          serviceName: (linked?.name ?? body.serviceName).trim(),
          company: body.company.trim(),
          contactName: body.contactName.trim(),
          designation: body.designation?.trim() ?? "",
          phone: body.phone.trim(),
          email: body.email?.trim() ?? "",
          sector: body.sector,
          scope: body.scope,
          timeline: body.timeline,
          siteLocation: body.siteLocation?.trim() ?? "",
          load: body.load?.trim() ?? "",
          budget: body.budget?.trim() ?? "",
          notes: body.notes?.trim() ?? "",
          status: "New",
        },
      });
      set.status = 201;
      return toIndustrialLead(lead);
    },
    { body: createIndustrialLeadDto },
  )

  .post(
    "/api/contact",
    async ({ body, set, request, server }) => {
      guardSubmissions(request, server, "contact");

      const message = await prisma.contactMessage.create({
        data: {
          name: body.name.trim(),
          phone: body.phone?.trim() ?? "",
          email: body.email?.trim() ?? "",
          message: body.message.trim(),
        },
      });
      set.status = 201;
      return { ok: true, id: message.id };
    },
    { body: createContactMessageDto },
  );
