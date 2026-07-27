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
