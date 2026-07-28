import { CONFIG } from "../config";
import type { MediaType } from "../types";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function classifyMimeType(mimeType: string): MediaType | null {
  if (CONFIG.allowedImageMimeTypes.includes(mimeType)) return "image";
  if (CONFIG.allowedVideoMimeTypes.includes(mimeType)) return "video";
  return null;
}

export function extensionForMimeType(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? "bin";
}

/* ===== Content sniffing ===== */

/**
 * `file.type` on an upload is whatever the client wrote in the multipart
 * headers — it says nothing about the bytes. It is also what gets stored and
 * later replayed as the `Content-Type` of the served file, so believing it
 * means an uploader chooses the Content-Type this service will hand browsers.
 * These signatures check the bytes actually are what the upload claims.
 */
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

/** Bytes to read off the front of an upload for the check above. */
export const SNIFF_BYTES = 16;
