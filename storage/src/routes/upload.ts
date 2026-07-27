import { requireApiKey } from "../middleware/auth";
import { HttpError } from "../lib/errors";
import { serializeMedia } from "../lib/serialize";
import { uploadMedia } from "../services/mediaService";
import { CONFIG } from "../config";

export async function handleUpload(req: Request): Promise<Response> {
  requireApiKey(req);

  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > CONFIG.maxUploadSizeBytes) {
    throw new HttpError(413, "request exceeds MAX_UPLOAD_SIZE_BYTES");
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const entityType = formData.get("entityType");
  const entityId = formData.get("entityId");
  const sortOrderRaw = formData.get("sortOrder");

  if (!(file instanceof File)) {
    throw new HttpError(400, "missing required field: file");
  }
  if (typeof entityType !== "string" || !entityType) {
    throw new HttpError(400, "missing required field: entityType");
  }
  if (typeof entityId !== "string" || !entityId) {
    throw new HttpError(400, "missing required field: entityId");
  }

  let sortOrder = 0;
  if (typeof sortOrderRaw === "string" && sortOrderRaw !== "") {
    const parsed = Number(sortOrderRaw);
    if (!Number.isInteger(parsed)) {
      throw new HttpError(400, "sortOrder must be an integer");
    }
    sortOrder = parsed;
  }

  const media = await uploadMedia({ file, entityType, entityId, sortOrder });
  return Response.json(serializeMedia(media), { status: 201 });
}
