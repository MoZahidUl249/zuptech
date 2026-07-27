import { requireApiKey } from "../middleware/auth";
import { HttpError } from "../lib/errors";
import { deleteMedia } from "../services/mediaService";
import { validateMediaId } from "../lib/validate";

export async function handleDeleteMedia(req: Request, id: string): Promise<Response> {
  requireApiKey(req);
  validateMediaId(id);

  const deleted = await deleteMedia(id);
  if (!deleted) throw new HttpError(404, "media not found");

  return new Response(null, { status: 204 });
}
