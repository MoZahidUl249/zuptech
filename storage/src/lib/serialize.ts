import type { MediaWithVariants } from "../types";

export function serializeMedia(media: MediaWithVariants) {
  return {
    id: media.id,
    entityType: media.entity_type,
    entityId: media.entity_id,
    mediaType: media.media_type,
    status: media.status,
    originalFilename: media.original_filename,
    mimeType: media.mime_type,
    sizeBytes: Number(media.size_bytes),
    width: media.width,
    height: media.height,
    durationMs: media.duration_ms,
    errorMessage: media.error_message,
    sortOrder: media.sort_order,
    createdAt: media.created_at,
    variants: media.variants.map((v) => ({
      variant: v.variant,
      url: `/files/${media.id}/${v.variant}`,
      mimeType: v.mime_type,
      sizeBytes: Number(v.size_bytes),
      width: v.width,
      height: v.height,
    })),
  };
}
