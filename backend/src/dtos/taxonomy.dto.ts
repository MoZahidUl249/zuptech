import { t } from "elysia";
import { MAX_SVG_LOGO_BYTES } from "../lib/rules";

/**
 * Catalog taxonomy: Section → Category → Product. Unlike hero slides and the
 * old solution list, these are per-item CRUD rather than whole-document PUTs —
 * a category's logo is uploaded against its row id, which a delete-and-recreate
 * save would invalidate on every write.
 */

const sectionFields = {
  name: t.String({ minLength: 1, maxLength: 80 }),
  sort: t.Integer({ minimum: 0, maximum: 999 }),
};

export const createSectionDto = t.Object(sectionFields);
export const updateSectionDto = t.Partial(t.Object(sectionFields));

const categoryFields = {
  name: t.String({ minLength: 1, maxLength: 80 }),
  sectionId: t.String({ minLength: 1, maxLength: 50 }),
  sort: t.Integer({ minimum: 0, maximum: 999 }),
};

export const createCategoryDto = t.Object(categoryFields);
export const updateCategoryDto = t.Partial(t.Object(categoryFields));

/**
 * Category logos are SVG markup stored on the row, not files on the
 * media-storage service (which only takes raster formats and rasterizes what
 * it stores). `""` clears the logo. The markup is validated and rejected if it
 * carries anything active — see `sanitizeSvgLogo` in lib/rules.ts.
 */
export const setCategoryLogoDto = t.Object({
  svg: t.String({ maxLength: MAX_SVG_LOGO_BYTES }),
});

export type CreateSectionDto = typeof createSectionDto.static;
export type UpdateSectionDto = typeof updateSectionDto.static;
export type CreateCategoryDto = typeof createCategoryDto.static;
export type UpdateCategoryDto = typeof updateCategoryDto.static;
export type SetCategoryLogoDto = typeof setCategoryLogoDto.static;
