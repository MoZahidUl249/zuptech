import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a number, got: ${raw}`);
  }
  return parsed;
}

function csv(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

const apiKey = requireEnv("API_KEY");
if (apiKey.length < 16) {
  throw new Error("API_KEY must be at least 16 characters long");
}

const storageRoot = requireEnv("STORAGE_ROOT");

export const CONFIG = {
  port: optionalInt("PORT", 3100),
  host: optionalEnv("HOST", "0.0.0.0"),
  apiKey,
  databaseUrl: requireEnv("DATABASE_URL"),
  storageRoot,
  maxUploadSizeBytes: optionalInt("MAX_UPLOAD_SIZE_BYTES", 500 * 1024 * 1024),
  thumbnailSize: optionalInt("THUMBNAIL_SIZE", 300),
  mediumMaxDimension: optionalInt("MEDIUM_MAX_DIMENSION", 1200),
  posterMaxWidth: optionalInt("POSTER_MAX_WIDTH", 600),
  ffmpegPath: optionalEnv("FFMPEG_PATH", "ffmpeg"),
  ffprobePath: optionalEnv("FFPROBE_PATH", "ffprobe"),
  allowedImageMimeTypes: csv("ALLOWED_IMAGE_MIME_TYPES", [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]),
  allowedVideoMimeTypes: csv("ALLOWED_VIDEO_MIME_TYPES", [
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ]),
  logLevel: optionalEnv("LOG_LEVEL", "info"),
  isDev: optionalEnv("BUN_ENV", "production") !== "production",
};

export async function ensureStorageRoot(): Promise<void> {
  if (!existsSync(CONFIG.storageRoot)) {
    await mkdir(CONFIG.storageRoot, { recursive: true });
  }
}
