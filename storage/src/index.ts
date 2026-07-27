import { CONFIG, ensureStorageRoot } from "./config";
import { errorToResponse } from "./lib/errors";
import { handleUpload } from "./routes/upload";
import { handleGetMedia } from "./routes/getMedia";
import { handleListMedia } from "./routes/listMedia";
import { handleDeleteMedia } from "./routes/deleteMedia";
import { handleServeFile } from "./routes/serveFile";
import { handleHealth } from "./routes/health";

await ensureStorageRoot();

function wrap<T extends string>(handler: (req: Bun.BunRequest<T>) => Promise<Response>) {
  return async (req: Bun.BunRequest<T>) => {
    try {
      return await handler(req);
    } catch (err) {
      return errorToResponse(err);
    }
  };
}

const server = Bun.serve({
  port: CONFIG.port,
  hostname: CONFIG.host,
  idleTimeout: 120,
  routes: {
    "/health": {
      GET: wrap(() => handleHealth()),
    },
    "/media": {
      POST: wrap((req) => handleUpload(req)),
      GET: wrap((req) => handleListMedia(req)),
    },
    "/media/:id": {
      GET: wrap<"/media/:id">((req) => handleGetMedia(req, req.params.id)),
      DELETE: wrap<"/media/:id">((req) => handleDeleteMedia(req, req.params.id)),
    },
    "/files/:id/:variant": {
      GET: wrap<"/files/:id/:variant">((req) => handleServeFile(req, req.params.id, req.params.variant)),
      HEAD: wrap<"/files/:id/:variant">((req) => handleServeFile(req, req.params.id, req.params.variant)),
    },
  },
  fetch() {
    return new Response("not found", { status: 404 });
  },
});

console.log(`media-storage-service listening on http://${server.hostname}:${server.port}`);
