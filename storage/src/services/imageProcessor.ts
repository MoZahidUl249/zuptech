import sharp from "sharp";
import { CONFIG } from "../config";

export interface ImageDimensions {
  width: number;
  height: number;
}

export async function readImageDimensions(path: string): Promise<ImageDimensions> {
  const meta = await sharp(path).rotate().metadata();
  return { width: meta.width ?? 0, height: meta.height ?? 0 };
}

/** Square cover-cropped JPEG thumbnail. */
export async function generateThumbnail(
  sourcePath: string,
  destPath: string
): Promise<ImageDimensions> {
  const size = CONFIG.thumbnailSize;
  await sharp(sourcePath)
    .rotate()
    .resize(size, size, { fit: "cover" })
    .jpeg({ quality: 80 })
    .toFile(destPath);
  return { width: size, height: size };
}

/** Aspect-preserving resize, longest edge capped, JPEG output. */
export async function generateMedium(
  sourcePath: string,
  destPath: string
): Promise<ImageDimensions> {
  const maxDim = CONFIG.mediumMaxDimension;
  const info = await sharp(sourcePath)
    .rotate()
    .resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(destPath);
  return { width: info.width, height: info.height };
}

/** Resize an arbitrary source image (e.g. an extracted video frame) to a max width, JPEG output. */
export async function generatePosterFromFrame(
  sourcePath: string,
  destPath: string
): Promise<ImageDimensions> {
  const maxWidth = CONFIG.posterMaxWidth;
  const info = await sharp(sourcePath)
    .resize(maxWidth, undefined, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(destPath);
  return { width: info.width, height: info.height };
}
