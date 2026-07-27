import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { CONFIG } from "../config";
import { checkDbConnection } from "../db";

const startedAt = Date.now();

export async function handleHealth(): Promise<Response> {
  const [dbOk, storageOk] = await Promise.all([
    checkDbConnection(),
    access(CONFIG.storageRoot, constants.W_OK)
      .then(() => true)
      .catch(() => false),
  ]);

  const healthy = dbOk && storageOk;
  return Response.json(
    {
      status: healthy ? "ok" : "unhealthy",
      db: dbOk ? "ok" : "fail",
      storage: storageOk ? "ok" : "fail",
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
