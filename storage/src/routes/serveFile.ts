import { HttpError } from "../lib/errors";
import { parseRangeHeader } from "../lib/range";
import { validateMediaId, validateVariant } from "../lib/validate";
import { getVariant } from "../services/mediaService";
import { absolutePath } from "../services/storage";

function etagFor(variantId: string, sizeBytes: number): string {
  return `"${variantId}-${sizeBytes}"`;
}

export async function handleServeFile(req: Request, id: string, variant: string): Promise<Response> {
  validateMediaId(id);
  const variantName = validateVariant(variant);

  const row = await getVariant(id, variantName);
  if (!row) throw new HttpError(404, "variant not found");

  const bunFile = Bun.file(absolutePath(row.storage_path));
  if (!(await bunFile.exists())) throw new HttpError(404, "file not found on disk");

  const fileSize = bunFile.size;
  const etag = etagFor(row.id, fileSize);

  const headers = new Headers({
    "Content-Type": row.mime_type,
    "Accept-Ranges": "bytes",
    ETag: etag,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Last-Modified": new Date(row.created_at).toUTCString(),
  });

  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers });
  }

  const rangeHeader = req.headers.get("range");
  const range = parseRangeHeader(rangeHeader, fileSize);

  if (range === undefined) {
    headers.set("Content-Range", `bytes */${fileSize}`);
    return new Response(null, { status: 416, headers });
  }

  if (range === null) {
    headers.set("Content-Length", String(fileSize));
    if (req.method === "HEAD") return new Response(null, { status: 200, headers });
    return new Response(bunFile, { status: 200, headers });
  }

  const { start, end } = range;
  const chunkSize = end - start + 1;
  headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
  headers.set("Content-Length", String(chunkSize));
  if (req.method === "HEAD") return new Response(null, { status: 206, headers });

  const slice = bunFile.slice(start, end + 1);
  return new Response(slice, { status: 206, headers });
}
