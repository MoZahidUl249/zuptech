#!/usr/bin/env bun
/**
 * Load harness.
 *
 * Written rather than reached for off the shelf because `oha`, `bombardier`
 * and friends answer one question — how fast does it serve bytes — and the
 * question that matters here is a different one: **does it stay CORRECT while
 * it is busy?** A storefront that returns 200s at 800 req/s and quietly
 * double-creates a product, loses a stock decrement, or drops an admin write on
 * the floor has failed, and no generic tool would notice. So the read traffic
 * and a full admin CRUD loop run against the same server at the same time, and
 * every single write is asserted.
 *
 *   bun run scripts/loadtest.ts ramp     --base https://zuptech.local
 *   bun run scripts/loadtest.ts sustain  --base https://zuptech.local --concurrency 120 --requests 100000
 *
 * `ramp` walks concurrency up until latency or errors break, and prints where
 * the knee is. `sustain` holds a fixed concurrency for N requests with the
 * admin loop running throughout.
 *
 * Reaching the write path needs a staff session. Either credentials, or a
 * session you already have — the second exists because the first is what stops
 * people running this:
 *
 *   --user arif --pass '…'
 *   --cookie-file scratchpad/admin-cookies.txt   # a curl cookie jar
 *   --cookie '__Secure-better-auth.session_token=…'
 *   --no-admin                                   # read-only, on purpose
 *
 * Without one of those the run aborts in a second rather than driving load for
 * half an hour and reporting `cycles: 0` as though it were a result.
 *
 * Self-signed certificate: run with NODE_TLS_REJECT_UNAUTHORIZED=0, or add the
 * CA to the trust store. The harness does not disable verification itself —
 * a load tool silently accepting any certificate is how a misconfigured TLS
 * setup goes unnoticed.
 */

/* ===== Arguments ===== */

const argv = process.argv.slice(2);
const mode = argv[0] ?? "ramp";

function arg(name: string, fallback: string): string {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : fallback;
}

const BASE = arg("base", "https://zuptech.local").replace(/\/$/, "");
const REQUESTS = Number(arg("requests", "100000"));
const CONCURRENCY = Number(arg("concurrency", "100"));
const STEP_SECONDS = Number(arg("step", "30"));
const ADMIN_USER = arg("user", "arif");
const ADMIN_PASS = arg("pass", "zup123");
const NO_ADMIN = argv.includes("--no-admin");
/**
 * An already-established staff session, instead of signing in.
 *
 * `--cookie "__Secure-better-auth.session_token=…"`, or a curl cookie jar via
 * `--cookie-file scratchpad/admin-cookies.txt`.
 *
 * The write path is the whole reason this harness exists, and requiring a
 * password to reach it means a box where nobody remembers the password is a
 * box where the write path never gets tested — which is exactly what happened.
 * A session the operator already has in their browser is enough, and it avoids
 * resetting a live credential just to run a load test.
 */
const ADMIN_COOKIE = arg("cookie", "");
const ADMIN_COOKIE_FILE = arg("cookie-file", "");

/* ===== Statistics =====
 *
 * Latencies are kept as a plain array and sorted at the end. At 100k samples
 * that is a few megabytes and an exact percentile; a histogram would be
 * approximate for no benefit at this scale.
 */

interface Stats {
  latencies: number[];
  byStatus: Map<number, number>;
  errors: Map<string, number>;
  bytes: number;
}

const newStats = (): Stats => ({
  latencies: [],
  byStatus: new Map(),
  errors: new Map(),
  bytes: 0,
});

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i]!;
}

function bump<K>(map: Map<K, number>, key: K) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function summarize(stats: Stats, seconds: number) {
  const sorted = [...stats.latencies].sort((a, b) => a - b);
  const total = stats.latencies.length;
  const ok = [...stats.byStatus.entries()]
    .filter(([s]) => s >= 200 && s < 400)
    .reduce((sum, [, n]) => sum + n, 0);
  const throttled = stats.byStatus.get(429) ?? 0;
  const failed = total - ok - throttled;
  return {
    total,
    seconds: Number(seconds.toFixed(1)),
    rps: Math.round(total / seconds),
    ok,
    throttled,
    failed,
    // 429s are excluded: a limiter doing its job is not the server failing.
    errorRate: total ? Number(((failed / total) * 100).toFixed(2)) : 0,
    p50: Math.round(percentile(sorted, 50)),
    p95: Math.round(percentile(sorted, 95)),
    p99: Math.round(percentile(sorted, 99)),
    max: Math.round(sorted[sorted.length - 1] ?? 0),
    statuses: Object.fromEntries([...stats.byStatus].sort((a, b) => a[0] - b[0])),
    errors: Object.fromEntries(stats.errors),
  };
}

/* ===== Traffic mix =====
 *
 * Weighted the way a storefront actually gets hit: mostly landing on pages,
 * a minority reaching the JSON API, a sliver pricing a cart. An even split
 * across endpoints would over-weight the cheap ones and flatter the result.
 */

interface Hit {
  path: string;
  method?: string;
  body?: unknown;
}

let catalogue: { slug: string }[] = [];
let campaignSlug: string | null = null;

function nextHit(): Hit {
  const roll = Math.random();
  if (roll < 0.35) return { path: "/" };
  if (roll < 0.6) return { path: "/shop" };
  if (roll < 0.8) {
    const product = catalogue[Math.floor(Math.random() * catalogue.length)];
    return { path: product ? `/products/${product.slug}` : "/shop" };
  }
  if (roll < 0.9) return { path: "/api/products" };
  if (roll < 0.95) {
    const product = catalogue[Math.floor(Math.random() * catalogue.length)];
    return {
      path: "/api/pricing/quote",
      method: "POST",
      body: {
        items: [{ productId: product ? productIdBySlug.get(product.slug) : "ips1000", qty: 2 }],
        insideDhaka: true,
      },
    };
  }
  return { path: campaignSlug ? `/lp/${campaignSlug}` : "/" };
}

const productIdBySlug = new Map<string, string>();

/** One request, timed. Never throws — a transport failure is a data point. */
async function fire(hit: Hit, stats: Stats) {
  const started = performance.now();
  try {
    const res = await fetch(`${BASE}${hit.path}`, {
      method: hit.method ?? "GET",
      ...(hit.body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(hit.body) }),
    });
    const body = await res.arrayBuffer();
    stats.bytes += body.byteLength;
    stats.latencies.push(performance.now() - started);
    bump(stats.byStatus, res.status);
  } catch (err) {
    stats.latencies.push(performance.now() - started);
    bump(stats.byStatus, 0);
    bump(stats.errors, err instanceof Error ? err.message.slice(0, 80) : String(err).slice(0, 80));
  }
}

/**
 * Hold `concurrency` requests in flight until the budget runs out.
 *
 * Each worker loops rather than firing a fixed slice, so a slow response
 * doesn't leave a lane idle — concurrency stays at the target instead of
 * decaying toward the slowest request.
 */
async function drive(opts: {
  concurrency: number;
  deadline?: number;
  requests?: number;
  stats: Stats;
  onProgress?: (done: number) => void;
}) {
  let issued = 0;
  let done = 0;
  const limit = opts.requests ?? Infinity;

  async function worker() {
    while (true) {
      if (opts.deadline !== undefined && Date.now() >= opts.deadline) return;
      if (issued >= limit) return;
      issued++;
      await fire(nextHit(), opts.stats);
      done++;
      if (opts.onProgress && done % 5000 === 0) opts.onProgress(done);
    }
  }

  await Promise.all(Array.from({ length: opts.concurrency }, worker));
}

/* ===== Admin CRUD loop =====
 *
 * The point of the whole exercise. Runs against the same server while it is
 * saturated, and asserts every response — status AND body. A write that
 * "succeeds" with the wrong body is the failure mode that matters, and the one
 * a throughput tool cannot see.
 */

interface AdminResult {
  cycles: number;
  failures: { step: string; detail: string }[];
  latencies: number[];
  createdProductIds: string[];
}

/** Flipped when the read traffic finishes, so the admin loop stops with it. */
const running = { value: true };

interface AdminSession {
  headers: Record<string, string>;
  categoryId: string;
}

/*
 * Log in and find somewhere to hang test products, BEFORE any load starts.
 *
 * This used to live at the top of the admin loop and report a bad credential
 * as a `failures` entry, which meant a wrong password produced a run that
 * looked complete: read traffic drove for its full length, the summary printed,
 * and `cycles: 0` sat in the output as though zero write cycles were a result
 * rather than the absence of one. A run happened that way and nobody noticed
 * until the numbers were compared by hand.
 *
 * Asserting writes is the entire reason this harness exists instead of `oha`,
 * so failing to reach the write path is fatal, not a data point. Throwing here
 * — before `drive()` — also means a typo costs a second rather than 36 minutes.
 */
/**
 * Pull the session cookie out of a curl/wget cookie jar.
 *
 * Netscape format: tab-separated, one cookie per line, value in the last
 * field. Comment lines start with `#` — except `#HttpOnly_`, which is a real
 * entry curl marks rather than a comment, and is exactly the line the session
 * token lives on.
 */
async function cookieFromJar(path: string): Promise<string> {
  const text = await Bun.file(path).text();
  const pairs = text
    .split("\n")
    .filter((line) => line.trim() && (!line.startsWith("#") || line.startsWith("#HttpOnly_")))
    .map((line) => line.split("\t"))
    .filter((f) => f.length >= 7)
    .map((f) => `${f[5]}=${f[6]}`);
  if (pairs.length === 0) throw new Error(`No cookies found in ${path}`);
  return pairs.join("; ");
}

async function adminSetup(): Promise<AdminSession> {
  let cookie: string;

  if (ADMIN_COOKIE || ADMIN_COOKIE_FILE) {
    cookie = ADMIN_COOKIE || (await cookieFromJar(ADMIN_COOKIE_FILE));
    // Prove the session is live before driving load, for the same reason the
    // password path does: an expired cookie must fail now, not look like a
    // write-path failure 20 minutes in.
    const probe = await fetch(`${BASE}/admin/api/products`, { headers: { cookie } });
    if (!probe.ok) {
      throw new Error(
        `Supplied admin session is not valid: ${probe.status} ${(await probe.text()).slice(0, 200)}\n` +
          `Sign in to the admin panel and export a fresh cookie, or use --user/--pass.`,
      );
    }
  } else {
    const login = await fetch(`${BASE}/admin/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
    });
    if (!login.ok) {
      throw new Error(
        `Admin login failed as "${ADMIN_USER}": ${login.status} ${(await login.text()).slice(0, 200)}\n` +
          `Pass working credentials with --user/--pass, an existing session with ` +
          `--cookie/--cookie-file, or --no-admin to run read-only on purpose.`,
      );
    }
    // Better Auth sets an httpOnly cookie; fetch won't persist it for us.
    cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
    if (!cookie) throw new Error("Admin login returned 200 but no session cookie.");
  }

  const headers = { "Content-Type": "application/json", cookie };
  const categories = await (await fetch(`${BASE}/admin/api/categories`, { headers })).json();
  const categoryId = Array.isArray(categories) && categories[0]?.id;
  if (!categoryId) throw new Error("No category exists to attach test products to.");

  return { headers, categoryId };
}

async function adminLoop(deadline: number, session: AdminSession): Promise<AdminResult> {
  const result: AdminResult = { cycles: 0, failures: [], latencies: [], createdProductIds: [] };
  const fail = (step: string, detail: string) => result.failures.push({ step, detail });
  const { headers, categoryId } = session;

  let n = 0;
  while (running.value && Date.now() < deadline) {
    const started = performance.now();
    const tag = `zzload-${Date.now()}-${n++}`;

    // --- create a product (server-first, the one-step path) ---
    // createProductDto requires the full field set — every money column, the
    // display fields and the initial stock counts. Sending a partial body gets
    // a 422 whose `detail` lists what was received but not what was missing,
    // so this is spelled out rather than trimmed to the interesting fields.
    const createRes = await fetch(`${BASE}/admin/api/products`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: `Load ${tag}`,
        slug: tag,
        categoryId,
        price: 5000,
        minDeposit: 0,
        onSale: false,
        salePrice: 0,
        deliveryFeeInsideDhaka: 100,
        deliveryFeeOutsideDhaka: 200,
        installationFeeInsideDhaka: 0,
        installationFeeOutsideDhaka: 0,
        imgHint: "",
        specs: [],
        description: "",
        visible: true,
        cost: 3000,
        reorderAt: 2,
        photos: [],
        stock: 10,
        reserved: 0,
      }),
    });
    if (createRes.status !== 201) {
      fail("create product", `${createRes.status} ${(await createRes.text()).slice(0, 200)}`);
      continue;
    }
    const created = (await createRes.json()) as { id: string; name: string; price: number };
    if (created.name !== `Load ${tag}` || created.price !== 5000) {
      fail("create product", `body mismatch: ${JSON.stringify(created).slice(0, 200)}`);
    }
    result.createdProductIds.push(created.id);

    // --- patch it, and check the change actually took ---
    // `stock` is deliberately NOT patchable here — it only moves through
    // PATCH /admin/api/stock/:id, so that every change leaves a StockMovement.
    const patchRes = await fetch(`${BASE}/admin/api/products/${created.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ price: 7500 }),
    });
    if (!patchRes.ok) {
      fail("patch product", `${patchRes.status} ${(await patchRes.text()).slice(0, 200)}`);
    } else {
      const patched = (await patchRes.json()) as { price: number };
      if (patched.price !== 7500) {
        fail("patch product", `not applied: ${JSON.stringify(patched).slice(0, 200)}`);
      }
    }

    // --- a team member, created and deleted in the same cycle ---
    const teamRes = await fetch(`${BASE}/admin/api/team`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: `Load ${tag}`, role: "Load test", bio: "", sort: 0 }),
    });
    if (teamRes.status !== 201) {
      fail("create team", `${teamRes.status} ${(await teamRes.text()).slice(0, 200)}`);
    } else {
      const member = (await teamRes.json()) as { id: string };
      const del = await fetch(`${BASE}/admin/api/team/${member.id}`, { method: "DELETE", headers });
      if (!del.ok) fail("delete team", `${del.status}`);
    }

    // --- a read that has to aggregate: the dashboard ---
    const metrics = await fetch(`${BASE}/admin/api/metrics`, { headers });
    if (!metrics.ok) fail("metrics", `${metrics.status}`);
    else await metrics.arrayBuffer();

    // --- delete the product again, so the loop leaves nothing behind ---
    const delProduct = await fetch(`${BASE}/admin/api/products/${created.id}`, {
      method: "DELETE",
      headers,
    });
    if (delProduct.ok) {
      result.createdProductIds = result.createdProductIds.filter((id) => id !== created.id);
    } else {
      fail("delete product", `${delProduct.status} ${(await delProduct.text()).slice(0, 200)}`);
    }

    result.latencies.push(performance.now() - started);
    result.cycles++;
  }

  return result;
}

/* ===== Warm-up ===== */

/** Distinct product URLs to spread the product-page traffic over. */
const SAMPLE_SIZE = 500;
/** Largest page /api/products will serve — capped by the DTO. */
const PAGE = 200;

async function loadCatalogue() {
  /*
   * Pages, because /api/products stopped returning the catalogue.
   *
   * It used to answer with every visible product under a flat cap, and this
   * read whatever came back. It is now paged and defaults to a screenful, so
   * the same unpaged call returned 48 rows and the harness silently sampled 48
   * product URLs instead of 500 — hammering a handful of pages and reporting
   * the result as if it had exercised the catalogue. That is the failure mode
   * a load test can least afford: quieter numbers that look like an
   * improvement. Ask for pages until there are enough, and say so out loud.
   */
  const products: { slug: string; id: string }[] = [];
  let total = Infinity;

  while (products.length < SAMPLE_SIZE && products.length < total) {
    const url = `${BASE}/api/products?limit=${PAGE}&offset=${products.length}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Cannot reach ${url} — got ${res.status}`);

    total = Number(res.headers.get("x-total-count") ?? 0) || total;
    const page = (await res.json()) as { slug: string; id: string }[];
    if (page.length === 0) break;
    products.push(...page);
  }

  catalogue = products.slice(0, SAMPLE_SIZE);
  for (const p of products) productIdBySlug.set(p.slug, p.id);
  console.log(
    `Catalogue: ${total} products visible, sampling ${catalogue.length} over ${Math.ceil(products.length / PAGE)} page(s).`,
  );
}

/* ===== Modes ===== */

async function ramp() {
  const steps = [10, 25, 50, 100, 200, 400];
  console.log(`\nRamp — ${STEP_SECONDS}s per step against ${BASE}\n`);
  console.log("  conc     rps     p50     p95     p99   errors  throttled");
  console.log("  ─────────────────────────────────────────────────────────");

  const rows: { concurrency: number; summary: ReturnType<typeof summarize> }[] = [];
  let knee: number | null = null;

  for (const concurrency of steps) {
    const stats = newStats();
    const started = Date.now();
    await drive({ concurrency, deadline: started + STEP_SECONDS * 1000, stats });
    const summary = summarize(stats, (Date.now() - started) / 1000);
    rows.push({ concurrency, summary });

    console.log(
      `  ${String(concurrency).padStart(4)}  ${String(summary.rps).padStart(6)}  ` +
        `${String(summary.p50).padStart(5)}ms ${String(summary.p95).padStart(5)}ms ` +
        `${String(summary.p99).padStart(5)}ms  ${String(summary.errorRate).padStart(5)}%  ` +
        `${String(summary.throttled).padStart(8)}`,
    );

    // The knee: where p95 crosses a second or real errors appear. Recorded, not
    // stopped at — the steps past it show how it degrades, which is the part
    // that says whether it sheds load or falls over.
    if (knee === null && (summary.p95 > 1000 || summary.errorRate > 0.5)) {
      knee = concurrency;
    }
    // Let queues drain so the next step starts from rest.
    await Bun.sleep(3000);
  }

  const best = rows.reduce((a, b) => (b.summary.rps > a.summary.rps ? b : a));
  console.log(`\n  Peak throughput : ${best.summary.rps} req/s at concurrency ${best.concurrency}`);
  console.log(`  Knee            : ${knee === null ? "not reached in this range" : `concurrency ${knee}`}`);
  console.log(`  Suggested hold  : concurrency ${Math.max(10, Math.round((knee ?? best.concurrency) * 0.7))}`);

  await Bun.write("scratchpad/loadtest-ramp.json", JSON.stringify(rows, null, 2));
  console.log("  Written to scratchpad/loadtest-ramp.json");
}

async function sustain() {
  console.log(`\nSustain — ${REQUESTS} requests at concurrency ${CONCURRENCY} against ${BASE}`);
  console.log(NO_ADMIN ? "Admin CRUD loop: disabled\n" : "Admin CRUD loop: running concurrently\n");

  const stats = newStats();
  const started = Date.now();
  // Generous ceiling: the admin loop must outlive the read traffic, never cut
  // it short, or "no failures" would just mean "it stopped early".
  const deadline = started + 60 * 60_000;

  // Reach the write path before driving any load — see adminSetup.
  const session = NO_ADMIN ? null : await adminSetup();
  const admin = session ? adminLoop(deadline, session) : Promise.resolve(null);

  await drive({
    concurrency: CONCURRENCY,
    requests: REQUESTS,
    stats,
    onProgress: (done) => {
      const elapsed = (Date.now() - started) / 1000;
      const pct = ((done / REQUESTS) * 100).toFixed(0);
      console.log(`  ${pct.padStart(3)}%  ${done}/${REQUESTS}  ${Math.round(done / elapsed)} req/s`);
    },
  });

  const seconds = (Date.now() - started) / 1000;
  const summary = summarize(stats, seconds);

  // Stop the admin loop now the read traffic is finished, and wait for the
  // cycle in flight to land. Racing it instead would abandon a half-finished
  // cycle — leaving a product created but not deleted, and reporting a leak
  // this harness caused rather than one the server did.
  running.value = false;
  // Deliberately not caught: the admin loop throwing is a result, and
  // swallowing it here would print a read-only summary as though it passed.
  const adminResult = await admin;

  console.log("\n─── Read traffic ───────────────────────────────");
  console.log(JSON.stringify(summary, null, 2));

  if (adminResult) {
    const sorted = [...adminResult.latencies].sort((a, b) => a - b);
    console.log("\n─── Admin CRUD under load ──────────────────────");
    console.log(
      JSON.stringify(
        {
          cycles: adminResult.cycles,
          writesPerCycle: 6,
          failures: adminResult.failures.length,
          p50: Math.round(percentile(sorted, 50)),
          p95: Math.round(percentile(sorted, 95)),
          max: Math.round(sorted[sorted.length - 1] ?? 0),
          leakedProducts: adminResult.createdProductIds,
          detail: adminResult.failures.slice(0, 20),
        },
        null,
        2,
      ),
    );
  }

  await Bun.write(
    "scratchpad/loadtest-sustain.json",
    JSON.stringify({ summary, admin: adminResult }, null, 2),
  );
  console.log("\nWritten to scratchpad/loadtest-sustain.json");
}

/* ===== Entry ===== */

await loadCatalogue();
// A published campaign page, if there is one — /lp is a distinct render path.
try {
  const res = await fetch(`${BASE}/api/landing-pages/zup-ips-offer`);
  if (res.ok) campaignSlug = "zup-ips-offer";
} catch {
  /* no campaign page; the mix falls back to the home page */
}

if (mode === "ramp") await ramp();
else if (mode === "sustain") await sustain();
else {
  console.error(`Unknown mode "${mode}" — expected "ramp" or "sustain".`);
  process.exit(1);
}
