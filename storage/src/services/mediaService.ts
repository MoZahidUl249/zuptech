import { unlink } from "node:fs/promises";
import { sql } from "../db";
import { CONFIG } from "../config";
import { HttpError } from "../lib/errors";
import { newId } from "../lib/ids";
import { classifyMimeType, extensionForMimeType } from "../lib/mime";
import { validateIdentifier } from "../lib/validate";
import { absolutePath, deleteMediaDir, ensureMediaDir, variantRelativePath } from "./storage";
import {
  generateMedium,
  generatePosterFromFrame,
  generateThumbnail,
  readImageDimensions,
} from "./imageProcessor";
import { extractFrame, posterTimestampSeconds, probeVideo } from "./videoProcessor";
import type { MediaRow, MediaWithVariants, VariantRow } from "../types";

export interface UploadInput {
  file: File;
  entityType: string;
  entityId: string;
  sortOrder: number;
}

async function insertMediaRow(params: {
  id: string;
  entityType: string;
  entityId: string;
  mediaType: "image" | "video";
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
}): Promise<void> {
  await sql`
    INSERT INTO media (id, entity_type, entity_id, media_type, original_filename, mime_type, size_bytes, status, sort_order)
    VALUES (${params.id}, ${params.entityType}, ${params.entityId}, ${params.mediaType}, ${params.filename}, ${params.mimeType}, ${params.sizeBytes}, 'processing', ${params.sortOrder})
  `;
}

async function insertVariantRow(params: {
  mediaId: string;
  variant: "original" | "thumbnail" | "medium" | "poster";
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
}): Promise<void> {
  await sql`
    INSERT INTO media_variants (media_id, variant, storage_path, mime_type, size_bytes, width, height)
    VALUES (${params.mediaId}, ${params.variant}, ${params.storagePath}, ${params.mimeType}, ${params.sizeBytes}, ${params.width}, ${params.height})
  `;
}

async function markStatus(
  mediaId: string,
  status: "ready" | "failed",
  fields: { width?: number | null; height?: number | null; durationMs?: number | null; errorMessage?: string | null } = {}
): Promise<void> {
  await sql`
    UPDATE media
    SET status = ${status},
        width = COALESCE(${fields.width ?? null}, width),
        height = COALESCE(${fields.height ?? null}, height),
        duration_ms = COALESCE(${fields.durationMs ?? null}, duration_ms),
        error_message = ${fields.errorMessage ?? null},
        updated_at = now()
    WHERE id = ${mediaId}
  `;
}

export async function uploadMedia(input: UploadInput): Promise<MediaWithVariants> {
  const entityType = validateIdentifier(input.entityType, "entityType");
  const entityId = validateIdentifier(input.entityId, "entityId");

  if (input.file.size <= 0) {
    throw new HttpError(400, "file is empty");
  }
  if (input.file.size > CONFIG.maxUploadSizeBytes) {
    throw new HttpError(413, "file exceeds MAX_UPLOAD_SIZE_BYTES");
  }

  const mimeType = input.file.type || "application/octet-stream";
  const mediaType = classifyMimeType(mimeType);
  if (!mediaType) {
    throw new HttpError(415, `unsupported mime type: ${mimeType}`);
  }

  const mediaId = newId();
  const ext = extensionForMimeType(mimeType);
  const originalFilename = input.file.name || `upload.${ext}`;

  await insertMediaRow({
    id: mediaId,
    entityType,
    entityId,
    mediaType,
    filename: originalFilename,
    mimeType,
    sizeBytes: input.file.size,
    sortOrder: input.sortOrder,
  });

  try {
    await ensureMediaDir(entityType, entityId, mediaId);

    const originalRelPath = variantRelativePath(entityType, entityId, mediaId, `original.${ext}`);
    const originalAbsPath = absolutePath(originalRelPath);
    await Bun.write(originalAbsPath, input.file);

    await insertVariantRow({
      mediaId,
      variant: "original",
      storagePath: originalRelPath,
      mimeType,
      sizeBytes: input.file.size,
      width: null,
      height: null,
    });

    if (mediaType === "image") {
      const dims = await readImageDimensions(originalAbsPath);

      const thumbRelPath = variantRelativePath(entityType, entityId, mediaId, "thumbnail.jpg");
      const thumbDims = await generateThumbnail(originalAbsPath, absolutePath(thumbRelPath));
      const thumbFile = Bun.file(absolutePath(thumbRelPath));
      await insertVariantRow({
        mediaId,
        variant: "thumbnail",
        storagePath: thumbRelPath,
        mimeType: "image/jpeg",
        sizeBytes: thumbFile.size,
        width: thumbDims.width,
        height: thumbDims.height,
      });

      const mediumRelPath = variantRelativePath(entityType, entityId, mediaId, "medium.jpg");
      const mediumDims = await generateMedium(originalAbsPath, absolutePath(mediumRelPath));
      const mediumFile = Bun.file(absolutePath(mediumRelPath));
      await insertVariantRow({
        mediaId,
        variant: "medium",
        storagePath: mediumRelPath,
        mimeType: "image/jpeg",
        sizeBytes: mediumFile.size,
        width: mediumDims.width,
        height: mediumDims.height,
      });

      await markStatus(mediaId, "ready", { width: dims.width, height: dims.height });
    } else {
      const probe = await probeVideo(originalAbsPath);
      const posterRelPath = variantRelativePath(entityType, entityId, mediaId, "poster.jpg");
      const posterAbsPath = absolutePath(posterRelPath);
      const framePath = `${posterAbsPath}.frame.jpg`;

      await extractFrame(originalAbsPath, framePath, posterTimestampSeconds(probe.durationMs));
      const posterDims = await generatePosterFromFrame(framePath, posterAbsPath);
      await unlink(framePath).catch(() => {});

      const posterFile = Bun.file(posterAbsPath);
      await insertVariantRow({
        mediaId,
        variant: "poster",
        storagePath: posterRelPath,
        mimeType: "image/jpeg",
        sizeBytes: posterFile.size,
        width: posterDims.width,
        height: posterDims.height,
      });

      await markStatus(mediaId, "ready", {
        width: probe.width,
        height: probe.height,
        durationMs: probe.durationMs,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markStatus(mediaId, "failed", { errorMessage: message });
    throw new HttpError(500, `processing_failed: ${message}`);
  }

  const result = await getMediaById(mediaId);
  if (!result) throw new HttpError(500, "media disappeared after upload");
  return result;
}

export async function getMediaById(mediaId: string): Promise<MediaWithVariants | null> {
  const rows = await sql<MediaRow[]>`SELECT * FROM media WHERE id = ${mediaId}`;
  const media = rows[0];
  if (!media) return null;

  const variants = await sql<VariantRow[]>`
    SELECT * FROM media_variants WHERE media_id = ${mediaId} ORDER BY variant
  `;

  return { ...media, variants };
}

export async function listMediaForEntity(
  entityType: string,
  entityId: string,
  includeAll: boolean
): Promise<MediaWithVariants[]> {
  const mediaRows = includeAll
    ? await sql<MediaRow[]>`
        SELECT * FROM media
        WHERE entity_type = ${entityType} AND entity_id = ${entityId}
        ORDER BY sort_order, created_at
      `
    : await sql<MediaRow[]>`
        SELECT * FROM media
        WHERE entity_type = ${entityType} AND entity_id = ${entityId} AND status = 'ready'
        ORDER BY sort_order, created_at
      `;

  if (mediaRows.length === 0) return [];

  const ids = mediaRows.map((m) => m.id);
  const variantRows = await sql<VariantRow[]>`
    SELECT * FROM media_variants WHERE media_id IN ${sql(ids)} ORDER BY variant
  `;

  const variantsByMedia = new Map<string, VariantRow[]>();
  for (const v of variantRows) {
    const list = variantsByMedia.get(v.media_id) ?? [];
    list.push(v);
    variantsByMedia.set(v.media_id, list);
  }

  return mediaRows.map((m) => ({ ...m, variants: variantsByMedia.get(m.id) ?? [] }));
}

export async function deleteMedia(mediaId: string): Promise<boolean> {
  const rows = await sql<MediaRow[]>`
    DELETE FROM media WHERE id = ${mediaId} RETURNING entity_type, entity_id
  `;
  const deleted = rows[0];
  if (!deleted) return false;

  await deleteMediaDir(deleted.entity_type, deleted.entity_id, mediaId);
  return true;
}

export async function getVariant(
  mediaId: string,
  variant: string
): Promise<VariantRow | null> {
  const rows = await sql<VariantRow[]>`
    SELECT * FROM media_variants WHERE media_id = ${mediaId} AND variant = ${variant}
  `;
  return rows[0] ?? null;
}
