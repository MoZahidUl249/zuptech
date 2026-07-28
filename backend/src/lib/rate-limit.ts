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

/**
 * How many proxies sit between the internet and this process, i.e. how many
 * entries at the END of `x-forwarded-for` we put there ourselves.
 *
 * Default 1, because in this deployment exactly one hop appends: nginx sets
 * `$proxy_add_x_forwarded_for` (deploy/nginx/conf.d/zuptech.conf), and Next's
 * proxy passes the header through untouched — it only fills one in when the
 * header is absent (`??=` in next/dist/server/base-server.js). Raise this only
 * if you add another appending proxy in front, e.g. a CDN.
 */
const TRUSTED_PROXY_HOPS = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? 1));

interface IpSource {
  requestIP(request: Request): { address: string } | null;
}

/**
 * The address to rate-limit a request by.
 *
 * `server.requestIP()` alone is wrong here and was actively harmful: the
 * browser calls relative `/api/*` paths, which Next rewrites to this service
 * (fronend/next.config.ts), so every storefront request arrives from the one
 * frontend container. Each `*-ip:` bucket became a single global bucket — 20
 * orders per five minutes for the entire site — while providing no per-attacker
 * protection at all.
 *
 * The header is read from the RIGHT. A client can prepend anything it likes to
 * `x-forwarded-for`, but it cannot control what our own proxies append after
 * it, and a longer spoofed prefix only pushes the trusted entries further from
 * index 0 — never out of the position we read. That is what makes this safe to
 * trust, and why the count is a hop count rather than "the first entry".
 */
export function clientIp(request: Request, server: IpSource | null | undefined): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const chain = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const trusted = chain[chain.length - TRUSTED_PROXY_HOPS];
    if (trusted) return trusted;
  }
  return server?.requestIP(request)?.address ?? "unknown";
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
