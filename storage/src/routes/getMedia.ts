import { HttpError } from "../lib/errors";
import { serializeMedia } from "../lib/serialize";
import { getMediaById } from "../services/mediaService";
import { validateMediaId } from "../lib/validate";

export async function handleGetMedia(req: Request, id: string): Promise<Response> {
  validateMediaId(id);
  const media = await getMediaById(id);
  if (!media) throw new HttpError(404, "media not found");

  return Response.json(serializeMedia(media), {
    headers: { "Cache-Control": "no-store" },
  });
}
