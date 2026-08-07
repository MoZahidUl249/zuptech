import { ApiError } from "./http";

/**
 * Upload validation. It used to live in a separate media service; it runs
 * here now, before anything reaches Cloudinary.
 * Cloudinary will happily store whatever bytes it's given, so this is now
 * the only thing standing between an upload and whatever Content-Type it
 * declared — a served asset replays that type, so an unchecked declaration
 * is an XSS vector (see the signature checks below).
 */

export type MediaType = "image" | "video";

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export function classifyMimeType(mimeType: string): MediaType | null {
  if (IMAGE_MIME_TYPES.includes(mimeType)) return "image";
  if (VIDEO_MIME_TYPES.includes(mimeType)) return "video";
  return null;
}

const ASCII = (s: string) => [...s].map((c) => c.charCodeAt(0));

interface Signature {
  /** Byte offset the pattern starts at. */
  offset: number;
  bytes: number[];
}

const SIGNATURES: Record<string, Signature[]> = {
  "image/jpeg": [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  "image/png": [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  "image/gif": [
    { offset: 0, bytes: ASCII("GIF87a") },
    { offset: 0, bytes: ASCII("GIF89a") },
  ],
  // RIFF....WEBP — the size field between the two markers is skipped.
  "image/webp": [{ offset: 0, bytes: ASCII("RIFF") }, { offset: 8, bytes: ASCII("WEBP") }],
  // ISO-BMFF: "ftyp" at offset 4. mp4 and mov share the container.
  "video/mp4": [{ offset: 4, bytes: ASCII("ftyp") }],
  "video/quicktime": [{ offset: 4, bytes: ASCII("ftyp") }],
  "video/webm": [{ offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }], // EBML
};

export const SNIFF_BYTES = 16;

function matches(head: Uint8Array, signature: Signature): boolean {
  if (head.length < signature.offset + signature.bytes.length) return false;
  return signature.bytes.every((byte, i) => head[signature.offset + i] === byte);
}

/**
 * True when `head` looks like the declared type. Unknown types return false —
 * a mime with no signature here can't be verified, so it isn't accepted.
 * WebP needs both of its patterns; everything else needs any one.
 */
export function contentMatchesMimeType(head: Uint8Array, mimeType: string): boolean {
  const signatures = SIGNATURES[mimeType];
  if (!signatures || signatures.length === 0) return false;
  return mimeType === "image/webp"
    ? signatures.every((s) => matches(head, s))
    : signatures.some((s) => matches(head, s));
}

/**
 * Validates size, declared MIME type, and that the bytes actually match the
 * declared type. Returns the buffer (already read, so callers don't read the
 * file twice) alongside the classified media type.
 */
export async function classifyAndValidate(
  file: File,
): Promise<{ mediaType: MediaType; buffer: Buffer }> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError(413, `File exceeds the ${MAX_UPLOAD_BYTES} byte limit`);
  }

  const mediaType = classifyMimeType(file.type);
  if (!mediaType) {
    throw new ApiError(415, `Unsupported content type: ${file.type}`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const head = buffer.subarray(0, SNIFF_BYTES);
  if (!contentMatchesMimeType(head, file.type)) {
    throw new ApiError(415, `File contents don't match declared type ${file.type}`);
  }

  return { mediaType, buffer };
}
