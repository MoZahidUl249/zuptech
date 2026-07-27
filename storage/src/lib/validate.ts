import { HttpError } from "./errors";

const SAFE_IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * entityType/entityId are attacker-controlled strings that get used directly as
 * filesystem path segments (see services/storage.ts). Restrict to a safe charset
 * to rule out path traversal ("../../etc") or absolute-path injection.
 */
export function validateIdentifier(value: string, fieldName: string): string {
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new HttpError(
      400,
      `${fieldName} must match ${SAFE_IDENTIFIER} (letters, numbers, dash, underscore, max 128 chars)`
    );
  }
  return value;
}

const SAFE_MEDIA_ID = /^[0-9a-fA-F-]{36}$/;

export function validateMediaId(value: string): string {
  if (!SAFE_MEDIA_ID.test(value)) {
    throw new HttpError(400, "invalid media id");
  }
  return value;
}

const VALID_VARIANTS = new Set(["original", "thumbnail", "medium", "poster"]);

export function validateVariant(value: string): "original" | "thumbnail" | "medium" | "poster" {
  if (!VALID_VARIANTS.has(value)) {
    throw new HttpError(400, "invalid variant");
  }
  return value as "original" | "thumbnail" | "medium" | "poster";
}
