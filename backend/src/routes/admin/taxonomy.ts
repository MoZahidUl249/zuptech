import { Elysia } from "elysia";
import {
  createCategoryDto,
  createSectionDto,
  setCategoryLogoDto,
  updateCategoryDto,
  updateSectionDto,
} from "../../dtos/taxonomy.dto";
import { prisma } from "../../lib/db";
import { badRequest, conflict, notFound } from "../../lib/http";
import { assertCan } from "../../lib/rbac";
import { sanitizeSvgLogo } from "../../lib/rules";
import { toCategory, toSection } from "../../lib/serialize";
import { staffGuard } from "./guard";

/**
 * Catalog taxonomy admin: Section → Category → Product. Per-item CRUD rather
 * than the whole-document PUTs used for slides — a category's logo is uploaded
 * against its row id, so ids have to survive a save. Rides the `products`
 * permission module, same as the catalog itself.
 *
 * Deletes are refused while anything still points at the row (categories under
 * a section, products in a category), mirroring the product-delete guard: the
 * FK is `onDelete: Restrict`, so this turns a 500 into an actionable 409.
 */
export const adminTaxonomy = new Elysia({
  name: "routes/admin/taxonomy",
  detail: { tags: ["Admin · Taxonomy"] },
})
  .use(staffGuard)

  /* ===== Sections ===== */

  .get("/admin/api/sections", async ({ staffCtx }) => {
    assertCan(staffCtx, "products", "view");
    const sections = await prisma.section.findMany({
      orderBy: { sort: "asc" },
      include: { categories: { orderBy: { sort: "asc" } } },
    });
    return sections.map(toSection);
  })

  .post(
    "/admin/api/sections",
    async ({ body, staffCtx, set }) => {
      assertCan(staffCtx, "products", "manage");
      const clash = await prisma.section.findUnique({ where: { name: body.name } });
      if (clash) throw conflict(`A section named "${body.name}" already exists`);

      const section = await prisma.section.create({
        data: body,
        include: { categories: { orderBy: { sort: "asc" } } },
      });
      set.status = 201;
      return toSection(section);
    },
    { body: createSectionDto },
  )

  .patch(
    "/admin/api/sections/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "products", "manage");
      const existing = await prisma.section.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Section");

      if (body.name && body.name !== existing.name) {
        const clash = await prisma.section.findUnique({ where: { name: body.name } });
        if (clash) throw conflict(`A section named "${body.name}" already exists`);
      }

      const section = await prisma.section.update({
        where: { id: params.id },
        data: body,
        include: { categories: { orderBy: { sort: "asc" } } },
      });
      return toSection(section);
    },
    { body: updateSectionDto },
  )

  .delete("/admin/api/sections/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "products", "manage");
    const existing = await prisma.section.findUnique({
      where: { id: params.id },
      include: { _count: { select: { categories: true } } },
    });
    if (!existing) throw notFound("Section");
    if (existing._count.categories > 0) {
      throw conflict("This section still has categories — move or delete them first");
    }
    await prisma.section.delete({ where: { id: params.id } });
    return { ok: true };
  })

  /* ===== Categories ===== */

  .get("/admin/api/categories", async ({ staffCtx }) => {
    assertCan(staffCtx, "products", "view");
    const categories = await prisma.category.findMany({
      orderBy: { sort: "asc" },
      include: { section: true },
    });
    return categories.map(toCategory);
  })

  .post(
    "/admin/api/categories",
    async ({ body, staffCtx, set }) => {
      assertCan(staffCtx, "products", "manage");

      const section = await prisma.section.findUnique({ where: { id: body.sectionId } });
      if (!section) throw notFound("Section");
      const clash = await prisma.category.findUnique({ where: { name: body.name } });
      if (clash) throw conflict(`A category named "${body.name}" already exists`);

      const category = await prisma.category.create({ data: body, include: { section: true } });
      set.status = 201;
      return toCategory(category);
    },
    { body: createCategoryDto },
  )

  .patch(
    "/admin/api/categories/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "products", "manage");
      const existing = await prisma.category.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Category");

      if (body.sectionId && body.sectionId !== existing.sectionId) {
        const section = await prisma.section.findUnique({ where: { id: body.sectionId } });
        if (!section) throw notFound("Section");
      }
      if (body.name && body.name !== existing.name) {
        const clash = await prisma.category.findUnique({ where: { name: body.name } });
        if (clash) throw conflict(`A category named "${body.name}" already exists`);
      }

      const category = await prisma.category.update({
        where: { id: params.id },
        data: body,
        include: { section: true },
      });
      return toCategory(category);
    },
    { body: updateCategoryDto },
  )

  .delete("/admin/api/categories/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "products", "manage");
    const existing = await prisma.category.findUnique({
      where: { id: params.id },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) throw notFound("Category");
    if (existing._count.products > 0) {
      throw conflict("This category still has products — move them to another category first");
    }

    // The logo is markup on the row, so deleting the row disposes of it.
    await prisma.category.delete({ where: { id: params.id } });
    return { ok: true };
  })

  /**
   * Set (or clear, with `svg: ""`) a category's logo. The markup is stored on
   * the row rather than uploaded, because the media-storage service only takes
   * raster formats. The storefront renders it inline, so anything active is
   * refused here — see `sanitizeSvgLogo`.
   */
  .put(
    "/admin/api/categories/:id/logo",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "products", "manage");
      const existing = await prisma.category.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Category");

      let svgLogo: string;
      try {
        svgLogo = sanitizeSvgLogo(body.svg);
      } catch (err) {
        throw badRequest(err instanceof Error ? err.message : "Invalid SVG logo");
      }

      const category = await prisma.category.update({
        where: { id: existing.id },
        data: { svgLogo },
        include: { section: true },
      });
      return toCategory(category);
    },
    { body: setCategoryLogoDto },
  );
