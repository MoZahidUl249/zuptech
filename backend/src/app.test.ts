import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * HTTP-level tests.
 *
 * Every other test in this suite tests a function. Nothing tested the thing a
 * client — or an attacker — actually talks to: the routes. ~100 endpoints were
 * covered only by clicking through the admin panel, which meant a deleted
 * `assertCan`, a guard that stopped throwing, or a DTO that quietly started
 * accepting a bad body would all have shipped with a green suite.
 *
 * These drive real `Request` objects through the real app: real routing, real
 * DTO validation, the real staffGuard, the real `assertCan`, and the real
 * onError hook that decides which status a thrown ApiError becomes. Only two
 * modules are replaced, both at the process boundary — `lib/db` (Postgres) and
 * `lib/auth` (Better Auth's session lookup). So there is no database and no
 * environment to configure: these run anywhere `bun test` runs.
 *
 * The three things asserted here are the three that are catastrophic when
 * wrong and invisible when broken: who is refused, what they are refused, and
 * that cart money is never the client's number.
 */

/* ========================================================================
 * Fakes
 * ==================================================================== */

/** What `auth.api.getSession` will return for the next request. */
let session: { user: { id: string } } | null = null;

/* The campaign a /duplicate call copies from, and the create Prisma was
 * asked to run. Both null by default so every other landingPage lookup in
 * this file keeps answering "not found". */
let landingSource: Record<string, unknown> | null = null;
let capturedLandingCreate: Record<string, unknown> | null = null;
let capturedLandingUpdate: Record<string, unknown> | null = null;

/** The Staff row behind that session — null models a *customer* session. */
let staffRow: {
  id: string;
  name: string;
  username: string;
  phone: string;
  email: string | null;
  role: { id: string; name: string; isSystem: boolean; permissions: Record<string, string> };
} | null = null;

/*
 * Shaped like a row with `productInclude` applied, not like the minimum
 * priceCart reads.
 *
 * It was the minimum, and that was enough right up until a public route
 * returned one of these: `toPublicProduct` reaches through `p.category.section`
 * and got a 500 out of a fixture that priceCart had never needed a category
 * for. Any row here has to survive serialization, because any row here can end
 * up in a response.
 */
interface FakeProduct {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  category: { name: string; svgLogo: string | null; section: { name: string } };
  price: number;
  minDepositPct: number;
  salePct: number;
  stockTag: string;
  /** The in-transit probe from productInclude — at most one row. */
  purchaseOrders: { id: string }[];
  recommendedIds: string[];
  onSale: boolean;
  salePrice: number;
  stock: number;
  reserved: number;
  deliveryFeeInsideDhaka: number;
  deliveryFeeOutsideDhaka: number;
  installationFeeInsideDhaka: number;
  installationFeeOutsideDhaka: number;
  quantityOffers: { minQty: number; amount: number }[];
  freeDeliveryOffers: { minQty: number; amount: number }[];
  rating: number;
  sold: number;
  imgHint: string | null;
  specs: string[];
  description: string | null;
  // Not nullable, and not `null` here either: the column is
  // `String @default("")`, and a fixture that says null sends the media
  // cleanup on delete into `null.startsWith(...)` — a 500 this suite would be
  // reporting against a shape the database cannot produce.
  video: string;
  photos: string[];
}

/** ৳1,000 each; 10+ take ৳200 off the unit price. */
const CATALOG: FakeProduct[] = [
  {
    id: "ips1000",
    slug: "1000va-ips",
    name: "1000VA IPS",
    categoryId: "cat-ips",
    category: { name: "IPS", svgLogo: null, section: { name: "Home" } },
    price: 1000,
    minDepositPct: 0,
    salePct: 0,
    stockTag: "",
    recommendedIds: [],
    onSale: false,
    salePrice: 0,
    stock: 5,
    reserved: 0,
    deliveryFeeInsideDhaka: 100,
    deliveryFeeOutsideDhaka: 200,
    installationFeeInsideDhaka: 50,
    installationFeeOutsideDhaka: 80,
    quantityOffers: [{ minQty: 10, amount: 200 }],
    freeDeliveryOffers: [],
    // The "is stock on the way" probe from productInclude. Empty = nothing
    // in transit, so this product's status tag derives from stock alone.
    purchaseOrders: [],
    rating: 0,
    sold: 0,
    imgHint: null,
    specs: [],
    description: null,
    video: "",
    photos: [],
  },
];

type Where = { id?: { in?: string[] } };

/** What DELETE /admin/api/products/:id sees hanging off the row it was asked
 *  to remove. Reassigned per test; nothing else reads it. */
let productCounts = {
  orderItems: 0,
  movements: 0,
  warranties: 0,
  landingPages: 0,
};

/** The product's purchase orders, read as rows because only a Received one is
 *  history — a Cancelled PO must not stand in the way of a delete. */
let productPurchaseOrders: { status: string }[] = [];

/** Product ids whose stock ledger the delete route cleared, in order. */
let deletedMovementsFor: string[] = [];

/** Same, for the purchase orders it cleared alongside the product. */
let deletedPosFor: string[] = [];

/** The subset of the client the delete route's transaction touches. Handed to
 *  the callback as `tx`, so what the route does inside the transaction is
 *  observable — the ledger clearing in particular. */
const txClient = {
  stockMovement: {
    deleteMany: async ({ where }: { where: { productId: string } }) => {
      deletedMovementsFor.push(where.productId);
      return { count: 0 };
    },
  },
  purchaseOrder: {
    deleteMany: async ({ where }: { where: { productId: string } }) => {
      deletedPosFor.push(where.productId);
      return { count: 0 };
    },
  },
  product: { delete: async () => CATALOG[0] },
  siteConfig: {
    findUniqueOrThrow: async () => ({ featuredIds: [] }),
    update: async () => ({ featuredIds: [] }),
  },
};

mock.module("./lib/db", () => ({
  prisma: {
    // /health proves the adapter is connected before reporting ok.
    $queryRaw: async () => [{ "?column?": 1 }],
    $transaction: async (fn: (tx: typeof txClient) => Promise<unknown>) => fn(txClient),
    // getStaffContext's lookup — the door every admin route goes through.
    staff: { findUnique: async () => staffRow },
    // priceCart's catalog read. The `where` carries orderableProductWhere()'s
    // visibility clause too; filtering on id alone is enough here because
    // rules.test.ts already pins what that clause admits.
    product: {
      findMany: async ({ where }: { where?: Where } = {}) =>
        where?.id?.in ? CATALOG.filter((p) => where.id?.in?.includes(p.id)) : [],
      findFirst: async () => null,
      // The delete guard's lookup. `productCounts` is what the test under
      // "deleting a product refuses what the database would refuse" sets to
      // stand a product on top of history it can't be deleted out from under.
      findUnique: async () => ({
        ...CATALOG[0],
        _count: productCounts,
        purchaseOrders: productPurchaseOrders,
      }),
      // The catalogue is paged; the route asks for the matching total so the
      // shop can render page controls.
      count: async () => 0,
    },
    siteConfig: {
      findUnique: async () => ({ featuredIds: [] }),
      findUniqueOrThrow: async () => ({ featuredIds: [] }),
      update: async () => ({ featuredIds: [] }),
    },
    teamMember: { findMany: async () => [] },
    landingPage: {
      // The duplicate route looks the source up by id, then probes by slug
      // until it finds a free one — so the slug probe must answer null or the
      // collision loop never ends.
      findUnique: async ({ where }: { where?: { id?: string; slug?: string } } = {}) =>
        where?.slug !== undefined ? null : landingSource,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        capturedLandingUpdate = data;
        return { ...landingSource, ...data, product: CATALOG[0] };
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        capturedLandingCreate = data;
        return {
          ...data,
          id: "lp-copy",
          viewCount: 0,
          orderCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          product: CATALOG[0],
        };
      },
    },
    paymentMethod: { findFirst: async () => null },
  },
}));

mock.module("./lib/auth", () => ({
  auth: { api: { getSession: async () => session } },
}));

const { createApp } = await import("./app");
const app = createApp({ quiet: true });

/** Send a real Request through the app and read status + JSON back. */
async function call(method: string, path: string, body?: unknown) {
  const res = await app.handle(
    new Request(`http://localhost${path}`, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    }),
  );
  let json: Record<string, unknown> | null = null;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty body */
  }
  return { status: res.status, body: json };
}

/** Sign in as staff holding exactly `permissions` and nothing else. */
function signInAs(permissions: Record<string, string>, { isSystem = false } = {}) {
  session = { user: { id: "u1" } };
  staffRow = {
    id: "s1",
    name: "Test Staff",
    username: "test",
    phone: "01700000000",
    email: null,
    role: { id: "r1", name: "Tester", isSystem, permissions },
  };
}

beforeEach(() => {
  session = null;
  staffRow = null;
  landingSource = null;
  capturedLandingCreate = null;
  capturedLandingUpdate = null;
});

/* ========================================================================
 * Who gets in
 * ==================================================================== */

describe("admin routes reject callers without a staff session", () => {
  test("no session at all is 401", async () => {
    const { status, body } = await call("GET", "/admin/api/products");
    expect(status).toBe(401);
    expect(body?.error).toBe("Staff sign-in required");
  });

  test("a customer session is 401, not 200", async () => {
    // The dangerous case: a real, valid session cookie — held by someone who
    // simply isn't staff. getStaffContext must fail it on the missing Staff
    // row, not on the missing session.
    session = { user: { id: "customer-1" } };
    staffRow = null;
    const { status } = await call("GET", "/admin/api/products");
    expect(status).toBe(401);
  });

  test("the guard covers writes as well as reads", async () => {
    const { status } = await call("POST", "/admin/api/team", {
      name: "X",
      role: "Y",
      bio: "",
      sort: 0,
    });
    expect(status).toBe(401);
  });

  test("public routes stay open", async () => {
    expect((await call("GET", "/api/products")).status).toBe(200);
    expect((await call("GET", "/api/team")).status).toBe(200);
    expect((await call("GET", "/health")).status).toBe(200);
  });

  test("?ids= returns just those products, so callers stop walking the catalogue", async () => {
    // The home page's featured row reaches its products by id. Before this it
    // downloaded the whole catalogue and filtered in the browser — one request
    // while /api/products answered with everything, then 23 parallel ones once
    // the route was paged.
    const { status, body } = await call("GET", "/api/products?ids=ips1000");
    expect(status).toBe(200);
    // `call` types the body as an object because most routes return one; this
    // route answers with a bare array (the total rides in x-total-count).
    const rows = body as unknown as { id: string }[];
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.map((p) => p.id)).toEqual(["ips1000"]);
  });

  test("?ids= ignores empty segments rather than matching nothing", async () => {
    // A trailing comma used to become an id, and an id that matches nothing
    // silently shrinks the result.
    const { status, body } = await call("GET", "/api/products?ids=ips1000,");
    expect(status).toBe(200);
    expect((body as unknown as { id: string }[]).map((p) => p.id)).toEqual(["ips1000"]);
  });

  test("health reports the database, not just the process", async () => {
    // It answered {ok:true} with Postgres stopped, so Docker kept reporting
    // the container healthy while no data route could be served.
    const up = await call("GET", "/health");
    expect(up.status).toBe(200);
    expect(up.body?.database).toBe("up");
  });
});

/* ========================================================================
 * What they're allowed to do
 * ==================================================================== */

describe("admin routes enforce per-module permissions", () => {
  test("a module the role doesn't hold is 403", async () => {
    signInAs({ sitecontent: "manage" }); // everything else defaults to none
    const { status, body } = await call("GET", "/admin/api/products");
    expect(status).toBe(403);
    expect(String(body?.error)).toContain("products");
  });

  test("holding one module does not grant another", async () => {
    signInAs({ products: "manage" });
    expect((await call("GET", "/admin/api/team")).status).toBe(403);
  });

  test("`view` reads but does not write", async () => {
    signInAs({ products: "view" });
    expect((await call("GET", "/admin/api/products")).status).toBe(200);
    // The 403 must come from assertCan, before the row is even looked up.
    expect((await call("DELETE", "/admin/api/products/ips1000")).status).toBe(403);
  });

  test("`manage` satisfies a `view` check", async () => {
    signInAs({ products: "manage" });
    expect((await call("GET", "/admin/api/products")).status).toBe(200);
  });

  test("an endpoint checks the module it belongs to, not just any module", async () => {
    // PATCH /admin/api/products/featured lives on the products router but is
    // gated on `homepage`, because it edits the home page. A products-only
    // role must not reach it just by being on the same router.
    signInAs({ products: "manage" });
    expect((await call("PATCH", "/admin/api/products/featured", { ids: [] })).status).toBe(403);

    signInAs({ homepage: "manage" });
    expect((await call("PATCH", "/admin/api/products/featured", { ids: [] })).status).toBe(200);
  });
});

/* ========================================================================
 * Deleting a product
 * ==================================================================== */


/* ========================================================================
 * Duplicating a campaign
 * ==================================================================== */

/* A representative row: the columns the model started with, one from each
   block of campaign copy added since, the theme, and the product row. */
const SOURCE = {
  id: "lp1",
  title: "Winter push",
  headline: "শীতের অফার",
  slug: "winter",
  productId: "ips1000",
  offerPrice: 1990,
  compareAtPrice: 2990,
  ribbonText: "আজই শেষ",
  buttonLabel: "অর্ডার করুন",
  footerNote: "note",
  benefitBullets: ["a"],
  imageHint: "hint",
  gtmId: "GTM-1",
  hotlineLabel: "হটলাইন",
  hotlineNumber: "০৯৬",
  headerCtaLabel: "অর্ডার",
  trustBadges: ["১০০% অরিজিনাল"],
  subheadline: "sub",
  discountBadge: "৩৩% ছাড়",
  heroCtaNote: "note",
  brandStripTitle: "পার্টনার",
  brandLogos: ["bKash"],
  videoTitle: "ভিডিও",
  videoUrl: "https://example.test/v",
  featuresTitle: "ফিচার",
  features: [{ title: "t", body: "b" }],
  specTitle: "স্পেক",
  specMeta: "REV 2",
  specs: [{ value: "20000", label: "mAh" }],
  bundlesTitle: "বান্ডেল",
  bundlesSubtitle: "sub",
  bundleUnitLabel: "পিস",
  bundleMaxQty: 3,
  qcTitle: "মান",
  qcBody: "body",
  qcPoints: ["p"],
  qcImageHint: "hint",
  countdownTitle: "শেষ",
  countdownNote: "note",
  countdownEndsAt: null,
  countdownCtaLabel: "কিনুন",
  countdownAssurance: "নিশ্চিন্তে",
  testimonialsTitle: "রিভিউ",
  testimonials: [{ quote: "q", name: "n", location: "l" }],
  formTitle: "অর্ডার",
  formIntro: "intro",
  formLabels: { name: "নাম" },
  footerTagline: "MAKES LIFE SIMPLE",
  footerAbout: "about",
  footerLines: ["line"],
  colorHeroBg: "#2B1B5E",
  colorHeroText: "#FFFFFF",
  colorBandBg: "#C62828",
  colorBandText: "#FFFFFF",
  colorTintBg: "#F6F1FF",
  colorPageBg: "#FFFFFF",
  colorPageText: "#15181E",
  colorAccent: "#2B1B5E",
  colorHighlight: "#FFD400",
  colorCtaBg: "#E85320",
  colorCtaText: "#FFFFFF",
  productRowIds: ["solar500", "vprot"],
  priceCompareLabel: "পূর্বের দাম",
  priceOfferLabel: "অফার প্রাইস",
  published: true,
  viewCount: 900,
  orderCount: 40,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-02-01"),
};

describe("POST /admin/api/landing-pages/:id/duplicate", () => {
  /** What a copy must NOT inherit. Everything else has to come across. */
  const RESET = ["id", "slug", "title", "published", "viewCount", "orderCount", "createdAt", "updatedAt"];

  /*
   * The regression this exists for. The handler used to name the columns it
   * copied, and the list was written when the model had eleven of them. By
   * the time the campaign template was rebuilt it carried 18 of 70 — so
   * duplicating a finished campaign silently produced a blank page with a
   * price on it, and the copy did not even keep its headline.
   *
   * Asserting "nothing is missing" rather than checking a handful of fields
   * is the point: a field-by-field test would have been written against the
   * same eleven columns and would have passed throughout.
   */
  test("carries every campaign column across, not a list someone has to maintain", async () => {
    signInAs({ landingpages: "manage" });
    landingSource = SOURCE;

    const { status } = await call("POST", "/admin/api/landing-pages/lp1/duplicate");
    expect(status).toBe(201);

    const data = capturedLandingCreate ?? {};
    const missing = Object.keys(SOURCE).filter((k) => !RESET.includes(k) && !(k in data));
    expect(missing).toEqual([]);
    // Spot-check the two that made the failure invisible: copy read as an
    // empty campaign, and the palette silently reverted to the default green.
    expect(data.headline).toBe(SOURCE.headline);
    expect(data.colorHeroBg).toBe("#2B1B5E");
    expect(data.productRowIds).toEqual(["solar500", "vprot"]);
  });

  test("but resets the things that belong to the original", async () => {
    signInAs({ landingpages: "manage" });
    landingSource = SOURCE;

    await call("POST", "/admin/api/landing-pages/lp1/duplicate");
    const data = capturedLandingCreate ?? {};

    // A copy is a draft, on its own URL, with its own reporting.
    expect(data.published).toBe(false);
    expect(data.slug).toBe("winter-copy");
    expect(data.title).toBe("Winter push (copy)");
    expect(data.id).toBeUndefined();
    expect(data.viewCount).toBeUndefined();
    expect(data.orderCount).toBeUndefined();
  });

  test("refuses a staff member who may only look at campaigns", async () => {
    signInAs({ landingpages: "view" });
    landingSource = SOURCE;
    const { status } = await call("POST", "/admin/api/landing-pages/lp1/duplicate");
    expect(status).toBe(403);
  });
});

describe("PATCH /admin/api/landing-pages/:id", () => {
  /*
   * The urgency block is optional and "" is how the editor says "no deadline"
   * — and toLandingPage emits "" for a null column, so it comes straight back
   * on the next save. Prisma refuses it (the column is DateTime?), so the
   * write threw and the route answered 500. Every campaign saved without a
   * deadline hit it, which is the default for a new page.
   */
  test("an empty countdown deadline stores null instead of throwing", async () => {
    signInAs({ landingpages: "manage" });
    landingSource = SOURCE;

    const { status } = await call("PATCH", "/admin/api/landing-pages/lp1", {
      countdownEndsAt: "",
    });

    expect(status).toBe(200);
    expect(capturedLandingUpdate?.countdownEndsAt).toBeNull();
  });

  test("a real deadline is stored as a date", async () => {
    signInAs({ landingpages: "manage" });
    landingSource = SOURCE;

    const { status } = await call("PATCH", "/admin/api/landing-pages/lp1", {
      countdownEndsAt: "2026-09-01T12:00:00.000Z",
    });

    expect(status).toBe(200);
    expect(capturedLandingUpdate?.countdownEndsAt).toBeInstanceOf(Date);
    expect((capturedLandingUpdate?.countdownEndsAt as Date).toISOString()).toBe(
      "2026-09-01T12:00:00.000Z",
    );
  });

  test("a malformed deadline is a 400 that names the field, not a 500", async () => {
    signInAs({ landingpages: "manage" });
    landingSource = SOURCE;

    const { status, body } = await call("PATCH", "/admin/api/landing-pages/lp1", {
      countdownEndsAt: "next tuesday",
    });

    expect(status).toBe(400);
    expect(String(body?.error)).toContain("countdownEndsAt");
  });
});
describe("deleting a product refuses what the database would refuse", () => {
  const counts = (over: Partial<typeof productCounts>) => {
    productCounts = { orderItems: 0, movements: 0, warranties: 0, landingPages: 0, ...over };
  };

  beforeEach(() => {
    deletedMovementsFor = [];
    deletedPosFor = [];
    productPurchaseOrders = [];
  });
  afterEach(() => {
    counts({});
    productPurchaseOrders = [];
  });

  // Trading history, one case each. A relation missing from the route's guard
  // reaches prisma.delete() and comes back as a 500 from Postgres — which is
  // what a landing page did in production.
  for (const relation of ["orderItems", "warranties", "landingPages"] as const) {
    test(`${relation} block the delete with a 409, not a 500`, async () => {
      signInAs({ products: "manage" });
      counts({ [relation]: 1 });
      const { status, body } = await call("DELETE", "/admin/api/products/ips1000");
      expect(status).toBe(409);
      expect(typeof body?.error).toBe("string");
    });
  }

  test("a received purchase order blocks — that one is inventory history", async () => {
    signInAs({ products: "manage" });
    productPurchaseOrders = [{ status: "Received" }];
    const { status, body } = await call("DELETE", "/admin/api/products/ips1000");
    expect(status).toBe(409);
    expect(String(body?.error)).toContain("received purchase order");
  });

  // DELETE /admin/api/purchase-orders/:id refuses only a Received PO, so a
  // Cancelled one is a row the inventory screen would delete on its own. It
  // blocked the product delete anyway: an order for 100 units that never
  // arrived made "Voltage Protector 220V 40A" permanently undeletable.
  for (const status of ["Cancelled", "Confirmed", "In transit"] as const) {
    test(`a ${status} purchase order does not block, and goes with the product`, async () => {
      signInAs({ products: "manage" });
      productPurchaseOrders = [{ status }];
      const res = await call("DELETE", "/admin/api/products/ips1000");
      expect(res.status).toBe(200);
      expect(deletedPosFor).toEqual(["ips1000"]);
    });
  }

  test("the refusal names what is behind the product, with counts", async () => {
    signInAs({ products: "manage" });
    counts({ orderItems: 2, warranties: 1 });
    productPurchaseOrders = [{ status: "Received" }];
    const { body } = await call("DELETE", "/admin/api/products/ips1000");
    // "ordered or bought in" left three screens to guess between.
    expect(String(body?.error)).toContain("2 order lines");
    expect(String(body?.error)).toContain("1 received purchase order");
    expect(String(body?.error)).toContain("1 warranty");
  });

  test("a landing page names itself, so the operator knows what to go and delete", async () => {
    signInAs({ products: "manage" });
    counts({ landingPages: 2 });
    const { body } = await call("DELETE", "/admin/api/products/ips1000");
    expect(String(body?.error)).toContain("landing page");
  });

  // The counting ledger is not trading history. One stock adjustment used to
  // make a product permanently undeletable, which is how a mistyped test row
  // became a permanent catalogue entry with nothing behind it.
  test("a stock movement does not block — the ledger goes with the product", async () => {
    signInAs({ products: "manage" });
    counts({ movements: 3 });
    const { status } = await call("DELETE", "/admin/api/products/ips1000");
    expect(status).toBe(200);
    expect(deletedMovementsFor).toEqual(["ips1000"]);
  });
});

/* ========================================================================
 * Validation, and the 400/422 split
 * ==================================================================== */

describe("bodies are validated before any handler runs", () => {
  test("storefront validation failures are 400 with a reason", async () => {
    // cal-bk.md §2: the storefront contract is 400 + { error }.
    const { status, body } = await call("POST", "/api/pricing/quote", { items: [] });
    expect(status).toBe(400);
    expect(typeof body?.error).toBe("string");
  });

  test("admin validation failures are 422 with detail", async () => {
    signInAs({ sitecontent: "manage" });
    const { status, body } = await call("POST", "/admin/api/team", { role: "QA", bio: "", sort: 0 });
    expect(status).toBe(422);
    expect(body?.error).toBe("Invalid request");
    expect(body?.detail).toBeTruthy();
  });

  test("an anonymous caller is refused before its body is even parsed", async () => {
    // The session guard is a derive, so it runs ahead of schema validation:
    // a stranger gets 401 and learns nothing about the schema.
    const { status } = await call("POST", "/admin/api/products", { garbage: true });
    expect(status).toBe(401);
  });

  test("a signed-in caller's body is validated before the permission check", async () => {
    // Pinning the real ordering rather than the one that would be tidier.
    // Schema validation is a route hook and `assertCan` is the first line of
    // the handler, so a *signed-in* staff member sending nonsense to a module
    // they don't hold gets 422, not 403. That leaks the shape of a schema
    // already published at /openapi in dev, to someone already inside the
    // panel — so it is accepted, not a finding. If it ever matters, the fix is
    // a guard-level check, not a reordering inside the handler.
    signInAs({ products: "view" });
    const { status } = await call("POST", "/admin/api/products", { garbage: true });
    expect(status).toBe(422);
  });

  test("a missing route is 404, not 500", async () => {
    expect((await call("GET", "/api/no-such-thing")).status).toBe(404);
  });

  test("an unparseable body is the client's fault, not a server fault", async () => {
    // It used to fall through to the 500 branch, which also fires the error
    // reporter — so every broken client raised a false incident.
    const res = await app.handle(
      new Request("http://localhost/api/pricing/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; requestId?: string };
    expect(body.error).toBe("Malformed request body");
    // No request id: that field is what marks a response as a reported fault.
    expect(body.requestId).toBeUndefined();
  });
});

/* ========================================================================
 * Money
 * ==================================================================== */

describe("cart money is computed from the catalog, never from the client", () => {
  test("a quote prices from the catalog", async () => {
    const { status, body } = await call("POST", "/api/pricing/quote", {
      items: [{ productId: "ips1000", qty: 2 }],
      insideDhaka: true,
    });
    expect(status).toBe(200);
    expect(body?.subtotal).toBe(2000); // 2 × ৳1,000
    expect(body?.deliveryFee).toBe(200); // 2 × ৳100
    expect(body?.installationFee).toBe(100); // 2 × ৳50
    expect(body?.total).toBe(2300);
  });

  test("prices sent by the client are ignored, not honoured", async () => {
    // The whole point of cal-bk.md: a tampered cart must produce the same
    // numbers as an honest one.
    const { status, body } = await call("POST", "/api/pricing/quote", {
      items: [{ productId: "ips1000", qty: 2, price: 1, unitPrice: 1, lineTotal: 2 }],
      insideDhaka: true,
      subtotal: 2,
      total: 2,
    });
    expect(status).toBe(200);
    expect(body?.subtotal).toBe(2000);
    expect(body?.total).toBe(2300);
  });

  test("quantity tiers resolve server-side", async () => {
    const { body } = await call("POST", "/api/pricing/quote", {
      items: [{ productId: "ips1000", qty: 10 }],
    });
    expect(body?.subtotal).toBe(8000); // 10 × (৳1,000 − ৳200)
  });

  test("the per-product cap can't be lifted by splitting lines", async () => {
    const { status, body } = await call("POST", "/api/pricing/quote", {
      items: Array.from({ length: 2 }, () => ({ productId: "ips1000", qty: 99 })),
    });
    expect(status).toBe(400);
    expect(String(body?.error)).toContain("99");
  });

  test("an unknown product is refused rather than priced at zero", async () => {
    const { status, body } = await call("POST", "/api/pricing/quote", {
      items: [{ productId: "does-not-exist", qty: 1 }],
    });
    expect(status).toBe(400);
    expect(String(body?.error)).toContain("does-not-exist");
  });
});

/* ========================================================================
 * Checkout guard rails (everything before the transaction)
 * ==================================================================== */

describe("checkout validates identity before it prices anything", () => {
  const order = {
    name: "Test Buyer",
    phone: "01712345678",
    address: "12 Test Road, Dhaka",
    insideDhaka: true,
    pay: "Cash on delivery",
    items: [{ productId: "ips1000", qty: 1 }],
  };

  test("a malformed phone is 400", async () => {
    const { status, body } = await call("POST", "/api/orders", { ...order, phone: "12345" });
    expect(status).toBe(400);
    expect(String(body?.error)).toContain("01XXXXXXXXX");
  });

  test("a one-character name is 400", async () => {
    const { status, body } = await call("POST", "/api/orders", { ...order, name: "A" });
    expect(status).toBe(400);
    expect(String(body?.error)).toContain("Name");
  });

  test("stock is enforced at order time even though quotes ignore it", async () => {
    // qty 6 against stock 5: the quote endpoint would happily price it.
    const quote = await call("POST", "/api/pricing/quote", {
      items: [{ productId: "ips1000", qty: 6 }],
      insideDhaka: true,
    });
    expect(quote.status).toBe(200);

    const { status, body } = await call("POST", "/api/orders", {
      ...order,
      items: [{ productId: "ips1000", qty: 6 }],
    });
    expect(status).toBe(400);
    expect(String(body?.error)).toContain("in stock");
  });

  test("a payment method that isn't enabled is refused", async () => {
    // paymentMethod.findFirst is stubbed to null — i.e. nothing enabled.
    const { status, body } = await call("POST", "/api/orders", order);
    expect(status).toBe(400);
    expect(String(body?.error)).toContain("not available");
  });
});

/* ========================================================================
 * Campaign pages
 * ==================================================================== */

describe("unpublished campaign pages are invisible", () => {
  test("an unpublished page 404s exactly like a missing one", async () => {
    const missing = await call("GET", "/api/landing-pages/nope");
    expect(missing.status).toBe(404);
    expect(missing.body?.error).toBe("Landing page not found");
  });
});
