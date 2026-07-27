import { CONFIG } from "../config";
import { HttpError } from "../lib/errors";

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i]! ^ bufB[i]!;
  }
  return diff === 0;
}

export function requireApiKey(req: Request): void {
  const key = req.headers.get("x-api-key");
  if (!key || !timingSafeEqual(key, CONFIG.apiKey)) {
    throw new HttpError(401, "unauthorized");
  }
}
