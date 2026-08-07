import { t } from "elysia";
import {
  industrialLeadStatusDto,
  industrialScopeDto,
  industrialSectorDto,
  industrialTimelineDto,
  leadStatusDto,
} from "./common";

/** Service enquiry from /solutions — open endpoint, strict caps for spam.
 *  `serviceId` must reference an existing Service row (the route 404s
 *  otherwise), so leads can be grouped by service in reporting. */
export const createLeadDto = t.Object({
  serviceId: t.String({ minLength: 1, maxLength: 50 }),
  customer: t.String({ minLength: 2, maxLength: 120 }),
  // Optional, unlike the `city` it replaced: that was required with a
  // two-character minimum, so the booking form posted the literal string
  // "Not given" whenever a visitor left it blank.
  address: t.Optional(t.String({ maxLength: 200 })),
  email: t.Optional(t.String({ maxLength: 200 })),
  phone: t.Optional(t.String({ maxLength: 20 })),
  notes: t.Optional(t.String({ maxLength: 2000 })),
});

/** Industrial/EPC enquiry from /industrial — open endpoint, strict caps.
 *
 *  Unlike createLeadDto this asks for the company, not a person + city: the
 *  qualifying facts for a B2B project are sector, scope, timeline and
 *  connected load, and sales triages on those.
 *
 *  `industrialServiceId` is optional and best-effort — the route only links it
 *  when it resolves to a real IndustrialService row (the page can render a
 *  static fallback list whose ids have no row), so a stale id degrades to an
 *  unlinked lead instead of a 404. `serviceName` is what always gets stored. */
export const createIndustrialLeadDto = t.Object({
  industrialServiceId: t.Optional(t.String({ maxLength: 50 })),
  serviceName: t.String({ minLength: 2, maxLength: 160 }),
  company: t.String({ minLength: 2, maxLength: 160 }),
  contactName: t.String({ minLength: 2, maxLength: 120 }),
  designation: t.Optional(t.String({ maxLength: 120 })),
  phone: t.String({ minLength: 6, maxLength: 20 }),
  email: t.Optional(t.String({ maxLength: 200 })),
  sector: industrialSectorDto,
  scope: industrialScopeDto,
  timeline: industrialTimelineDto,
  siteLocation: t.Optional(t.String({ maxLength: 160 })),
  load: t.Optional(t.String({ maxLength: 60 })),
  budget: t.Optional(t.String({ maxLength: 60 })),
  notes: t.Optional(t.String({ maxLength: 2000 })),
});

export const listIndustrialLeadsQueryDto = t.Object({
  status: t.Optional(industrialLeadStatusDto),
  sector: t.Optional(industrialSectorDto),
});
export const updateIndustrialLeadStatusDto = t.Object({ status: industrialLeadStatusDto });

/** Contact form — also open, also capped. */
export const createContactMessageDto = t.Object({
  name: t.String({ minLength: 2, maxLength: 120 }),
  phone: t.Optional(t.String({ maxLength: 20 })),
  email: t.Optional(t.String({ maxLength: 200 })),
  message: t.String({ minLength: 5, maxLength: 5000 }),
});

export const listLeadsQueryDto = t.Object({ status: t.Optional(leadStatusDto) });
export const updateLeadStatusDto = t.Object({ status: leadStatusDto });
export const listCustomersQueryDto = t.Object({ q: t.Optional(t.String()) });
export const updateContactMessageDto = t.Object({ read: t.Boolean() });

export type CreateLeadDto = typeof createLeadDto.static;
export type CreateIndustrialLeadDto = typeof createIndustrialLeadDto.static;
export type ListIndustrialLeadsQueryDto = typeof listIndustrialLeadsQueryDto.static;
export type UpdateIndustrialLeadStatusDto = typeof updateIndustrialLeadStatusDto.static;
export type CreateContactMessageDto = typeof createContactMessageDto.static;
export type ListLeadsQueryDto = typeof listLeadsQueryDto.static;
export type UpdateLeadStatusDto = typeof updateLeadStatusDto.static;
export type ListCustomersQueryDto = typeof listCustomersQueryDto.static;
export type UpdateContactMessageDto = typeof updateContactMessageDto.static;
