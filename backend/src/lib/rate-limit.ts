/**
 * Sliding-window rate limiting, in two flavours.
 *
 * `allowHit` is in-memory: cheap, per-process, and wiped by a restart. Right
 * for high-volume, low-stakes paths — pricing quotes, the public lead forms,
 * campaign view counts — where a database write per request would cost more
 * than the abuse it prevents.
 *
 * `allowHitDurable` records attempts in Postgres. Right for auth, where the
 * in-memory version was actively weak: every deploy reset the counters, so a
 * brute-force attempt only had to outlast a restart, and the counts would have
 * been per-instance the moment this ran on two containers.
 */

import { prisma } from "./db";

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

/**
 * Same contract as `allowHit`, but the window is stored in Postgres so it
 * survives a restart and is shared across instances.
 *
 * Fails OPEN. If the database is unreachable the caller is allowed through:
 * a limiter that cannot read its own state must not become the reason nobody
 * can sign in. That is the right trade here because every endpoint using this
 * has its own authentication behind it — the limiter slows guessing, it is not
 * the thing keeping anyone out.
 */
export async function allowHitDurable(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  try {
    await prisma.rateLimitHit.create({ data: { key } });
    const used = await prisma.rateLimitHit.count({ where: { key, at: { gte: since } } });
    return used <= limit;
  } catch {
    return true;
  }
}

/**
 * Drop attempt rows nobody can still be inside the window for.
 *
 * An hour is comfortably longer than the widest window in use (5 minutes), so
 * this can never delete a row that still counts.
 */
export async function pruneRateLimitHits(): Promise<void> {
  const cutoff = new Date(Date.now() - 60 * 60_000);
  try {
    await prisma.rateLimitHit.deleteMany({ where: { at: { lt: cutoff } } });
  } catch {
    // A failed prune is a disk-space problem, not a correctness one.
  }
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

// The durable table needs the same treatment, less often — it only holds auth
// attempts, so it grows slowly.
setInterval(() => void pruneRateLimitHits(), 30 * 60_000).unref?.();
