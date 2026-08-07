import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { ApiError } from "./http";
import { classifyAndValidate, type MediaType } from "./media-validate";

/**
 * Media storage on Cloudinary. Every upload/delete goes through this module
 * so entity rows only ever hold a plain Cloudinary delivery URL — the same
 * shape a hand-written media service used to hand back, kept so callers
 * did not have to change when uploads moved to Cloudinary.
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
 *
 * Passed to `cloudinary.url()` as objects, not raw strings: a bare string in
 * the `transformation` array is interpreted as a *named* transformation
 * (Cloudinary prefixes the URL with `t_...`) rather than these components.
 *
 * The string forms below (used by `parseCloudinaryRef` to strip the segment
 * back off) must match Cloudinary's own serialization order, which is
 * alphabetical by parameter code (c_, f_, q_, w_) — NOT the object's key
 * order or insertion order. Verified against a live upload; if the SDK's
 * ordering ever changes, `parseCloudinaryRef`'s round-trip test will catch it.
 */
const IMAGE_TRANSFORM = "c_limit,f_auto,q_auto,w_1600";
const VIDEO_TRANSFORM = "f_auto,q_auto";
const IMAGE_TRANSFORM_OPTS = { fetch_format: "auto", quality: "auto", width: 1600, crop: "limit" };
const VIDEO_TRANSFORM_OPTS = { fetch_format: "auto", quality: "auto" };

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
  const transformation = mediaType === "video" ? VIDEO_TRANSFORM_OPTS : IMAGE_TRANSFORM_OPTS;

  /*
   * Sent as a base64 data URI rather than a stream.
   *
   * Every multipart-streaming route in this SDK — upload_stream,
   * upload(path), upload_large(path) — silently drops the auth fields under
   * Bun once the payload reaches 1 MiB, and Cloudinary rejects the request
   * with "Upload preset must be specified when using unsigned upload". It
   * reads as a credentials problem and is not one: the config is fully
   * populated at call time. 1,024,000 bytes succeeds, 1,048,576 fails.
   *
   * That put every real upload on the floor — a phone photo or a 2000px
   * banner clears 1 MiB easily — while every test here passed, because the
   * fixtures are a few KB. The data-URI path is unaffected.
   *
   * The cost is base64's ~33% inflation against Cloudinary's 60 MB ceiling
   * for encoded uploads, so the practical raw limit is ~45 MB. That is far
   * above any image and covers the hero-video cap; product video is declared
   * larger (see MAX_UPLOAD_BYTES) and would need the streaming path restored
   * once Bun handles it.
   */
  const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;
  const result: UploadApiResponse = await cloudinary.uploader.upload(dataUri, {
    folder: `${folderPrefix()}/${entityType}/${entityId}`,
    resource_type: resourceType,
    tags: [entityType],
  });

  const url = cloudinary.url(result.public_id, {
    secure: true,
    resource_type: resourceType,
    version: result.version,
    format: result.format,
    transformation: [transformation],
    urlAnalytics: false,
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
