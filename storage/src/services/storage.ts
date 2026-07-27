import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { CONFIG } from "../config";

/** Path relative to STORAGE_ROOT for a given media item's directory, e.g. "product/1234/<mediaId>". */
export function mediaDirRelative(entityType: string, entityId: string, mediaId: string): string {
  return join(entityType, entityId, mediaId);
}

export function variantRelativePath(
  entityType: string,
  entityId: string,
  mediaId: string,
  filename: string
): string {
  return join(mediaDirRelative(entityType, entityId, mediaId), filename);
}

export function absolutePath(relativePath: string): string {
  return resolve(CONFIG.storageRoot, relativePath);
}

export async function ensureMediaDir(
  entityType: string,
  entityId: string,
  mediaId: string
): Promise<string> {
  const rel = mediaDirRelative(entityType, entityId, mediaId);
  const abs = absolutePath(rel);
  await mkdir(abs, { recursive: true });
  return abs;
}

export async function deleteMediaDir(
  entityType: string,
  entityId: string,
  mediaId: string
): Promise<void> {
  const abs = absolutePath(mediaDirRelative(entityType, entityId, mediaId));
  await rm(abs, { recursive: true, force: true });
}
