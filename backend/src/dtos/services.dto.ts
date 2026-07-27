import { t } from "elysia";
import { slugDto } from "./common";

/**
 * The two service catalogues behind /solutions. Same field set — Service is
 * bookable (ServiceLead references it), IndustrialService is display-only.
 * Per-item CRUD, because `image` is uploaded against a stable row id.
 */

const serviceFields = {
  slug: slugDto,
  name: t.String({ minLength: 1, maxLength: 120 }),
  dsc: t.String({ minLength: 1, maxLength: 600 }),
  features: t.Array(t.String({ minLength: 1, maxLength: 60 }), { maxItems: 12 }),
  sort: t.Integer({ minimum: 0, maximum: 999 }),
};

export const createServiceDto = t.Object(serviceFields);
export const updateServiceDto = t.Partial(t.Object(serviceFields));

export const uploadServiceImageDto = t.Object({
  file: t.File({ type: "image", maxSize: "8m" }),
});

export type CreateServiceDto = typeof createServiceDto.static;
export type UpdateServiceDto = typeof updateServiceDto.static;
export type UploadServiceImageDto = typeof uploadServiceImageDto.static;
