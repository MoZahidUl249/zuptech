import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { ApiError } from "./http";
import { classifyAndValidate, type MediaType } from "./media-validate";

/**
 * Media storage on Cloudinary. Every upload/delete goes through this module
 * so entity rows only ever hold a plain Cloudinary delivery URL — the same
 * shape a hand-written media-storage service used to hand back.
 */

function cloudName(): string | undefined {
  return process.env.CLOUDINARY_CLOUD_NAME;
}

let configured = false;
function ensureConfigured(): void {
  if (configured) return;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName() || !apiKey || !apiSecret) {
    throw new ApiError(
      500,
      "Cloudinary not configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET",
    );
  }
  cloudinary.config({ cloud_name: cloudName(), api_key: apiKey, api_secret: apiSecret, secure: true });
  configured = true;
}

/** Keeps dev/staging/prod sharing one Cloudinary account from colliding. */
function folderPrefix(): string {
  return process.env.CLOUDINARY_FOLDER_PREFIX || "zuptech";
}

type ResourceType = "image" | "video";

/**
 * Fixed, deterministic transformations baked into the URL path (never a
 * query string) — f_auto/q_auto is Cloudinary's standard format/quality
 * auto-optimization; the width cap on images replaces the old thumbnail/
 * medium variant generation. Because these are fixed strings we control,
 * `parseCloudinaryRef` can strip them back off deterministically.
 */
const IMAGE_TRANSFORM = "f_auto,q_auto,w_1600,c_limit";
const VIDEO_TRANSFORM = "f_auto,q_auto";

export interface StorageMedia {
  id: string; // Cloudinary public_id
  mediaType: MediaType;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

/** Upload one file, tagged to the entity it belongs to (e.g. "product"/"ips1000"). */
export async function uploadMedia(
  file: File,
  entityType: string,
  entityId: string,
  _sortOrder = 0,
): Promise<StorageMedia> {
  ensureConfigured();
  const { mediaType, buffer } = await classifyAndValidate(file);
  const resourceType: ResourceType = mediaType === "video" ? "video" : "image";
  const transformation = mediaType === "video" ? VIDEO_TRANSFORM : IMAGE_TRANSFORM;

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: `${folderPrefix()}/${entityType}/${entityId}`,
        resource_type: resourceType,
        tags: [entityType],
      },
      (error, uploadResult) => {
        if (error || !uploadResult) reject(error ?? new Error("Cloudinary upload returned no result"));
        else resolve(uploadResult);
      },
    );
    upload.end(buffer);
  });

  const url = cloudinary.url(result.public_id, {
    secure: true,
    resource_type: resourceType,
    version: result.version,
    format: result.format,
    transformation: [transformation],
  });

  return {
    id: result.public_id,
    mediaType,
    url,
    mimeType: file.type,
    sizeBytes: result.bytes,
    width: result.width ?? null,
    height: result.height ?? null,
    durationMs: result.duration ? Math.round(result.duration * 1000) : null,
  };
}

export async function deleteMedia(publicId: string, resourceType: ResourceType): Promise<void> {
  ensureConfigured();
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    throw new ApiError(502, `Cloudinary delete failed: ${(err as Error).message}`);
  }
}

/**
 * Extracts the Cloudinary `public_id` (+ resource type) out of a URL this
 * module issued (`.../<image|video>/upload/<transform>/v<version>/<public_id>.<ext>`).
 * Matches only against our own known transform strings — same reasoning as
 * the old code's URL matching: rows written under a different convention
 * (or not ours at all — e.g. external URLs imported from elsewhere) must
 * come back null rather than a wrong guess.
 */
export function parseCloudinaryRef(
  fileUrl: string,
): { publicId: string; resourceType: ResourceType } | null {
  const cloud = cloudName();
  if (!cloud) return null;

  for (const resourceType of ["image", "video"] as const) {
    const base = `https://res.cloudinary.com/${cloud}/${resourceType}/upload/`;
    if (!fileUrl.startsWith(base)) continue;

    let rest = fileUrl.slice(base.length);
    const transform = resourceType === "video" ? VIDEO_TRANSFORM : IMAGE_TRANSFORM;
    if (rest.startsWith(`${transform}/`)) rest = rest.slice(transform.length + 1);

    const versionMatch = rest.match(/^v\d+\//);
    if (versionMatch) rest = rest.slice(versionMatch[0].length);

    const publicId = rest.replace(/\.[a-zA-Z0-9]+$/, "");
    if (!publicId) continue;
    return { publicId, resourceType };
  }
  return null;
}

/**
 * Best-effort delete for a photo/video slot being replaced or cleared — a
 * stale asset left behind on Cloudinary isn't worth failing the request
 * over, so failures (and non-Cloudinary URLs) are swallowed here.
 */
export async function deleteMediaByUrl(fileUrl: string): Promise<void> {
  const ref = parseCloudinaryRef(fileUrl);
  if (!ref) return;
  try {
    await deleteMedia(ref.publicId, ref.resourceType);
  } catch {
    // orphaned asset on Cloudinary — no audit trail needed here
  }
}
