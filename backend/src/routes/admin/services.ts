import { Elysia } from "elysia";
import {
  createServiceDto,
  updateServiceDto,
  uploadServiceImageDto,
} from "../../dtos/services.dto";
import { prisma } from "../../lib/db";
import { conflict, notFound } from "../../lib/http";
import { assertCan } from "../../lib/rbac";
import { toIndustrialService, toService } from "../../lib/serialize";
import { deleteMediaByUrl, uploadMedia } from "../../lib/storage";
import { staffGuard } from "./guard";

/**
 * The two service catalogues behind /solutions. Per-item CRUD (not the
 * whole-document PUT the old solution list used) because each row owns an
 * uploaded image keyed on its id — a delete-and-recreate save would orphan
 * every image on every write. Rides the `sitecontent` permission module.
 */
export const adminServices = new Elysia({
  name: "routes/admin/services",
  detail: { tags: ["Admin · Services"] },
})
  .use(staffGuard)

  /* ===== Services (bookable — ServiceLead points here) ===== */

  .get("/admin/api/services", async ({ staffCtx }) => {
    assertCan(staffCtx, "sitecontent", "view");
    const services = await prisma.service.findMany({ orderBy: { sort: "asc" } });
    return services.map(toService);
  })

  .post(
    "/admin/api/services",
    async ({ body, staffCtx, set }) => {
      assertCan(staffCtx, "sitecontent", "manage");
      const clash = await prisma.service.findUnique({ where: { slug: body.slug } });
      if (clash) throw conflict(`Slug "${body.slug}" is already in use`);

      const service = await prisma.service.create({ data: body });
      set.status = 201;
      return toService(service);
    },
    { body: createServiceDto },
  )

  .patch(
    "/admin/api/services/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "sitecontent", "manage");
      const existing = await prisma.service.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Service");

      if (body.slug && body.slug !== existing.slug) {
        const clash = await prisma.service.findUnique({ where: { slug: body.slug } });
        if (clash) throw conflict(`Slug "${body.slug}" is already in use`);
      }

      const service = await prisma.service.update({ where: { id: params.id }, data: body });
      return toService(service);
    },
    { body: updateServiceDto },
  )

  .delete("/admin/api/services/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "sitecontent", "manage");
    const existing = await prisma.service.findUnique({
      where: { id: params.id },
      include: { _count: { select: { leads: true } } },
    });
    if (!existing) throw notFound("Service");
    if (existing._count.leads > 0) {
      throw conflict("This service has enquiries attached — it can't be deleted");
    }

    await prisma.service.delete({ where: { id: params.id } });
    if (existing.image) await deleteMediaByUrl(existing.image);
    return { ok: true };
  })

  .post(
    "/admin/api/services/:id/image",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "sitecontent", "manage");
      const existing = await prisma.service.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Service");

      const media = await uploadMedia(body.file, "service", existing.id, 0);
      const url =
        media.variants.find((v) => v.variant === "medium")?.url ??
        media.variants.find((v) => v.variant === "original")!.url;

      const service = await prisma.service.update({
        where: { id: existing.id },
        data: { image: url },
      });
      if (existing.image) await deleteMediaByUrl(existing.image);
      return toService(service);
    },
    { body: uploadServiceImageDto },
  )

  /* ===== Industrial services (display-only) ===== */

  .get("/admin/api/industrial-services", async ({ staffCtx }) => {
    assertCan(staffCtx, "sitecontent", "view");
    const services = await prisma.industrialService.findMany({ orderBy: { sort: "asc" } });
    return services.map(toIndustrialService);
  })

  .post(
    "/admin/api/industrial-services",
    async ({ body, staffCtx, set }) => {
      assertCan(staffCtx, "sitecontent", "manage");
      const clash = await prisma.industrialService.findUnique({ where: { slug: body.slug } });
      if (clash) throw conflict(`Slug "${body.slug}" is already in use`);

      const service = await prisma.industrialService.create({ data: body });
      set.status = 201;
      return toIndustrialService(service);
    },
    { body: createServiceDto },
  )

  .patch(
    "/admin/api/industrial-services/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "sitecontent", "manage");
      const existing = await prisma.industrialService.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Industrial service");

      if (body.slug && body.slug !== existing.slug) {
        const clash = await prisma.industrialService.findUnique({ where: { slug: body.slug } });
        if (clash) throw conflict(`Slug "${body.slug}" is already in use`);
      }

      const service = await prisma.industrialService.update({
        where: { id: params.id },
        data: body,
      });
      return toIndustrialService(service);
    },
    { body: updateServiceDto },
  )

  .delete("/admin/api/industrial-services/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "sitecontent", "manage");
    const existing = await prisma.industrialService.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound("Industrial service");

    await prisma.industrialService.delete({ where: { id: params.id } });
    if (existing.image) await deleteMediaByUrl(existing.image);
    return { ok: true };
  })

  .post(
    "/admin/api/industrial-services/:id/image",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "sitecontent", "manage");
      const existing = await prisma.industrialService.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Industrial service");

      const media = await uploadMedia(body.file, "industrialservice", existing.id, 0);
      const url =
        media.variants.find((v) => v.variant === "medium")?.url ??
        media.variants.find((v) => v.variant === "original")!.url;

      const service = await prisma.industrialService.update({
        where: { id: existing.id },
        data: { image: url },
      });
      if (existing.image) await deleteMediaByUrl(existing.image);
      return toIndustrialService(service);
    },
    { body: uploadServiceImageDto },
  );
