/*
 * Client-side guards for admin image uploads.
 *
 * The real enforcement is server-side (Elysia `t.File({ type: "image",
 * maxSize })` on the route, then the MIME allowlist and magic-byte sniffing in
 * backend/src/lib/media-validate.ts), but failing here gives the admin a
 * useful message instead of an opaque 415/422 after a long upload.
 *
 * Kept in sync with ACCEPTED in backend/src/lib/media-validate.ts.
 */

/** Raster formats the backend accepts. SVG is rejected — it is markup, and an
 *  uploaded one is an XSS sink; that's why `accept="image/*"` isn't enough.
 *  Category logos take SVG *markup* through a sanitizer instead. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/** Value for an <input type="file"> accept attribute. Note this only filters
 *  the picker UI — it is not validation; always pair it with checkFile(). */
export const IMAGE_ACCEPT = ACCEPTED_IMAGE_TYPES.join(",");

/** Human-readable format list for helper text. */
export const IMAGE_FORMATS_LABEL = "JPG, PNG, WebP or GIF";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Short "1920 × 720 · 284 KB · JPG" caption for an uploaded file. */
export function describeImage(
  dims: { width: number; height: number } | null,
  bytes: number,
  mime: string,
): string {
  const kind = mime.replace(/^image\//, "").toUpperCase();
  const size = formatBytes(bytes);
  return dims ? `${dims.width} × ${dims.height} · ${size} · ${kind}` : `${size} · ${kind}`;
}

/**
 * Validate type and size before uploading. Returns an error message to show
 * the user, or null when the file is acceptable.
 */
export function checkImageFile(file: File, maxBytes: number): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return `Unsupported format — use ${IMAGE_FORMATS_LABEL}.`;
  }
  if (file.size > maxBytes) {
    return `Image too large (${formatBytes(file.size)}) — keep uploads under ${formatBytes(maxBytes)}.`;
  }
  return null;
}

/** Read pixel dimensions without uploading. Returns null if undecodable. */
export async function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  } catch {
    return null;
  }
}

/**
 * Advisory-only check for banner artwork. Returns a warning to surface after a
 * successful upload, or null. Deliberately never blocks: a slightly-small
 * image is a judgement call the admin can make, not an error.
 */
export function bannerDimensionWarning(dims: { width: number; height: number }): string | null {
  if (dims.width < 1600) {
    return `That's only ${dims.width}px wide — it may look soft on large screens. 2000px or wider is recommended.`;
  }
  const ratio = dims.width / dims.height;
  if (ratio < 1.8 || ratio > 3.4) {
    return `Unusual shape (${ratio.toFixed(1)}:1) — banners look best between 2:1 and 3:1.`;
  }
  return null;
}
