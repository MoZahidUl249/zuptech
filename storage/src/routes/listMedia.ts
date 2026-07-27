import { HttpError } from "../lib/errors";
import { serializeMedia } from "../lib/serialize";
import { listMediaForEntity } from "../services/mediaService";

export async function handleListMedia(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");
  const includeAll = url.searchParams.get("includeAll") === "true";

  if (!entityType || !entityId) {
    throw new HttpError(400, "entityType and entityId query params are required");
  }

  const items = await listMediaForEntity(entityType, entityId, includeAll);

  return Response.json(
    { entityType, entityId, items: items.map(serializeMedia) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
