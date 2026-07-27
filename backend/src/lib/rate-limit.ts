/**
 * Minimal in-memory sliding-window rate limiter for the auth endpoints
 * (login, register, password reset). Good enough for a single process; swap for a Redis-backed
 * limiter when the API runs on more than one instance.
 */

const hits = new Map<string, number[]>();

/**
 * Record a hit for `key` and report whether it is still within
 * `limit` hits per `windowMs`.
 */
export function allowHit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length <= limit;
}

// Cheap periodic cleanup so long-forgotten keys don't accumulate.
setInterval(() => {
  const now = Date.now();
  for (const [key, times] of hits) {
    const recent = times.filter((t) => now - t < 15 * 60_000);
    if (recent.length === 0) hits.delete(key);
    else hits.set(key, recent);
  }
}, 5 * 60_000).unref?.();
