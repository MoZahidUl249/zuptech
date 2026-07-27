import { ApiError } from "./http";

/**
 * Client for the standalone media-storage microservice (../storage — see its
 * README for the full HTTP contract). Write routes there require a shared
 * `X-API-Key`, which must never reach the browser — every upload/delete goes
 * through an admin route here that holds the key server-side.
 */

export interface StorageVariant {
  variant: "original" | "thumbnail" | "medium" | "poster";
  url: string; // absolute — already prefixed with STORAGE_URL
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
}

export interface StorageMedia {
  id: string;
  entityType: string;
  entityId: string;
  mediaType: "image" | "video";
  status: "processing" | "ready" | "failed";
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  sortOrder: number;
  createdAt: string;
  variants: StorageVariant[];
}

function config(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.STORAGE_URL?.replace(/\/$/, "");
  const apiKey = process.env.STORAGE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new ApiError(500, "Storage service not configured — set STORAGE_URL and STORAGE_API_KEY");
  }
  return { baseUrl, apiKey };
}

/** Upload one file, tagged to the entity it belongs to (e.g. "product"/"ips1000"). */
export async function uploadMedia(
  file: File,
  entityType: string,
  entityId: string,
  sortOrder = 0,
): Promise<StorageMedia> {
  const { baseUrl, apiKey } = config();

  const form = new FormData();
  form.append("file", file, file.name);
  form.append("entityType", entityType);
  form.append("entityId", entityId);
  form.append("sortOrder", String(sortOrder));

  const res = await fetch(`${baseUrl}/media`, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
    body: form,
  });
  if (!res.ok) {
    throw new ApiError(502, `Storage upload failed (${res.status}): ${await res.text()}`);
  }

  const media = (await res.json()) as StorageMedia;
  return { ...media, variants: media.variants.map((v) => ({ ...v, url: `${baseUrl}${v.url}` })) };
}

export async function deleteMedia(id: string): Promise<void> {
  const { baseUrl, apiKey } = config();
  const res = await fetch(`${baseUrl}/media/${id}`, {
    method: "DELETE",
    headers: { "X-API-Key": apiKey },
  });
  if (!res.ok && res.status !== 404) {
    throw new ApiError(502, `Storage delete failed (${res.status}): ${await res.text()}`);
  }
}

/** Media id embedded in a URL this service issued (`{STORAGE_URL}/files/{id}/{variant}`); null for anything else (external links, empty strings). */
export function parseMediaId(fileUrl: string): string | null {
  const baseUrl = process.env.STORAGE_URL?.replace(/\/$/, "");
  if (!baseUrl || !fileUrl.startsWith(`${baseUrl}/files/`)) return null;
  const id = fileUrl.slice(`${baseUrl}/files/`.length).split("/")[0];
  return id || null;
}

/**
 * Best-effort delete for a photo/video slot being replaced or cleared — a
 * stale file left behind on the storage service isn't worth failing the
 * request over, so failures (and non-storage URLs) are swallowed here.
 */
export async function deleteMediaByUrl(fileUrl: string): Promise<void> {
  const id = parseMediaId(fileUrl);
  if (!id) return;
  try {
    await deleteMedia(id);
  } catch {
    // orphaned file on the storage service — no audit trail needed here
  }
}
