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

/**
 * The origin a BROWSER uses to fetch media — which is not the one this process
 * uses to reach the storage service.
 *
 * STORAGE_URL is in-network (`http://storage:3100` under compose). The URLs we
 * return here get persisted into the database and later rendered in an <img>,
 * so they must be the public origin instead — nginx proxies
 * `https://media.<domain>/files/` to the same service. Prefixing them with
 * STORAGE_URL writes `http://storage:3100/files/...` into Product.photos,
 * which no browser can resolve: the image is broken permanently, and
 * re-uploading does not help because the next upload stores the same
 * unreachable origin.
 *
 * Falls back to STORAGE_URL, which is correct in local dev where the process
 * and the browser genuinely share an origin.
 */
function publicBaseUrl(): string {
  const url = process.env.STORAGE_PUBLIC_URL || process.env.STORAGE_URL || "";
  return url.replace(/\/$/, "");
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
  // publicBaseUrl(), never baseUrl — see the note there. These URLs are stored
  // and rendered in the browser; baseUrl is only good for server-to-server.
  const publicBase = publicBaseUrl();
  return { ...media, variants: media.variants.map((v) => ({ ...v, url: `${publicBase}${v.url}` })) };
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

/**
 * Media id embedded in a URL this service issued (`{base}/files/{id}/{variant}`);
 * null for anything else (external links, empty strings).
 *
 * Matches against BOTH origins on purpose. Rows written before
 * STORAGE_PUBLIC_URL existed hold the in-network one, and rows written since
 * hold the public one — if this only recognised the current origin, replacing
 * or clearing an older photo would silently fail to delete its file and leak
 * an orphan onto disk every time.
 */
export function parseMediaId(fileUrl: string): string | null {
  const bases = [publicBaseUrl(), (process.env.STORAGE_URL ?? "").replace(/\/$/, "")];
  for (const base of bases) {
    if (!base) continue;
    const prefix = `${base}/files/`;
    if (!fileUrl.startsWith(prefix)) continue;
    const id = fileUrl.slice(prefix.length).split("/")[0];
    if (id) return id;
  }
  return null;
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
