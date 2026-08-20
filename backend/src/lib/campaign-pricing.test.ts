import { beforeAll, describe, expect, mock, test } from "bun:test";

/**
 * The test this feature exists for: **the advertised total must equal the
 * charged total**.
 *
 * A campaign page prints its bundle rows from `toPublicLandingPage()`, and
 * checkout charges through `priceCart()`. Before campaign tiers those two
 * agreed only because both happened to call `effectiveUnitPrice()` with the
 * same arguments — an accident, pinned by nothing. Now that a campaign can
 * carry its own prices the two paths *could* diverge, and a divergence is not
 * a rendering bug: it is a page advertising ৳2,000 while the cart takes
 * ৳2,216. So the equality is asserted here directly, across every fixture
 * that could break it.
 *
 * `priceCart` reads the catalog through the shared `prisma` singleton, so the
 * module is mocked before it is imported — the same harness pricing.test.ts
 * uses. Note it needs only `product.findMany`: the campaign arrives already
 * resolved, which is exactly why `priceCart` still performs one query.
 */

const PRODUCT = {
  id: "toolset",
  name: "38-piece toolset",
  // The live shape that motivated the table: listed 2600, on sale at 2184, so
  // the product ladder could not express a useful bulk price at all.
  price: 2600,
  onSale: true,
  salePrice: 2184,
  stock: 500,
  reserved: 0,
  reorderAt: 2,
  deliveryFeeInsideDhaka: 80,
  deliveryFeeOutsideDhaka: 150,
  installationFeeInsideDhaka: 0,
  installationFeeOutsideDhaka: 0,
  stockTag: "",
  quantityOffers: [] as { minQty: number; amount: number }[],
  freeDeliveryOffers: [] as { minQty: number; amount: number }[],
};

/** The product as the landing-page mapper reads it — `toPublicProduct` walks
 *  category → section, so the relation has to be present even though nothing
 *  here asserts on it. */
const PRODUCT_ROW = {
  ...PRODUCT,
  categoryId: "tools",
  category: { name: "Tools", svgLogo: "", section: { name: "Hardware" } },
  minDepositPct: 0,
  rating: 0,
  sold: 0,
  imgHint: "",
  specs: [],
  description: "",
  video: "",
  photos: [] as string[],
  recommendedIds: [] as string[],
  purchaseOrders: [] as { id: string }[],
  visible: true,
};

/* Both paths must read ONE product row. Serving `priceCart` a different copy
   from the one the ladder maps would make every equality below vacuous — the
   two could agree only because they were pricing different things. */
mock.module("./db", () => ({
  prisma: {
    product: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        [PRODUCT_ROW].filter((p) => where.id.in.includes(p.id)),
    },
  },
}));

let priceCart: typeof import("./pricing").priceCart;
let toPublicLandingPage: typeof import("./serialize").toPublicLandingPage;

beforeAll(async () => {
  ({ priceCart } = await import("./pricing"));
  ({ toPublicLandingPage } = await import("./serialize"));
});

/** A landing-page row with only the columns the ladder and the mapper touch. */
function campaignRow(tiers: { minQty: number; unitPrice: number }[], bundleMaxQty = 3) {
  return {
    id: "lp1",
    slug: "toolset-offer",
    productId: PRODUCT.id,
    product: PRODUCT_ROW,
    tiers,
    bundleMaxQty,
    offerPrice: 2184,
    compareAtPrice: 2600,
    // Everything below is copy the mapper reads but this test does not assert.
    title: "Toolset",
    headline: "",
    ribbonText: "",
    buttonLabel: "",
    footerNote: "",
    benefitBullets: [],
    imageHint: "",
    gtmId: "",
    published: true,
    viewCount: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  } as unknown as Parameters<typeof toPublicLandingPage>[0];
}

/** What the resolver would hand `priceCart` for that row. */
const pricingFor = (row: ReturnType<typeof campaignRow>) => ({
  id: "lp1",
  productId: PRODUCT.id,
  tiers: (row as unknown as { tiers: { minQty: number; unitPrice: number }[] }).tiers,
});

/**
 * The core assertion, run against every fixture: for each row the page prints,
 * a cart of that quantity must cost exactly what the row promised.
 */
async function expectAdvertisedEqualsCharged(row: ReturnType<typeof campaignRow>) {
  const { bundles } = toPublicLandingPage(row);
  const campaign = pricingFor(row);

  for (const bundle of bundles) {
    const cart = await priceCart([{ productId: PRODUCT.id, qty: bundle.qty }], true, { campaign });
    expect(cart.lines[0]!.unitPrice).toBe(bundle.unitPrice);
    expect(cart.subtotal).toBe(bundle.total);
  }
  return bundles;
}

describe("the advertised bundle total is the total the cart charges", () => {
  test("with the campaign's own ladder", async () => {
    const bundles = await expectAdvertisedEqualsCharged(
      campaignRow([
        { minQty: 2, unitPrice: 2000 },
        { minQty: 3, unitPrice: 1900 },
      ]),
    );

    // …and the ladder is the one that was typed, not a derived approximation.
    expect(bundles.map((b) => b.unitPrice)).toEqual([2184, 2000, 1900]);
    expect(bundles.map((b) => b.total)).toEqual([2184, 4000, 5700]);
  });

  test("with no campaign ladder — the fallback still agrees", async () => {
    // The campaign is opt-in: an empty ladder must price exactly like the shop,
    // and the page must say so.
    const bundles = await expectAdvertisedEqualsCharged(campaignRow([]));
    expect(bundles.map((b) => b.unitPrice)).toEqual([2184, 2184, 2184]);
  });

  test("with a ladder priced ABOVE the shop — the inert tier agrees too", async () => {
    // The clamp has to hold on both paths, or the page shows one number and
    // the cart takes another in the one case nobody would think to check.
    const bundles = await expectAdvertisedEqualsCharged(
      campaignRow([{ minQty: 2, unitPrice: 2500 }]),
    );
    expect(bundles.map((b) => b.unitPrice)).toEqual([2184, 2184, 2184]);
    expect(bundles.every((b) => b.saving === 0)).toBe(true);
  });

  test("with the product's own ladder underneath — the cheaper of the two wins on both paths", async () => {
    // Mutated in place so the mock and the mapper keep sharing one row.
    PRODUCT_ROW.quantityOffers = [{ minQty: 2, amount: 700 }]; // → 1900, beats 2050
    try {
      const bundles = await expectAdvertisedEqualsCharged(
        campaignRow([{ minQty: 2, unitPrice: 2050 }]),
      );
      expect(bundles[1]!.unitPrice).toBe(1900);
    } finally {
      PRODUCT_ROW.quantityOffers = [];
    }
  });
});

describe("what a campaign may and may not reprice", () => {
  test("it prices its own product only — other lines are catalogue-priced", async () => {
    const campaign = { id: "lp1", productId: "something-else", tiers: [{ minQty: 1, unitPrice: 1 }] };

    const cart = await priceCart([{ productId: PRODUCT.id, qty: 2 }], true, { campaign });

    // The tier would have made this ৳1 if scope were not enforced.
    expect(cart.lines[0]!.unitPrice).toBe(2184);
  });

  test("no campaign at all is byte-identical to an empty ladder", async () => {
    const plain = await priceCart([{ productId: PRODUCT.id, qty: 3 }], true);
    const empty = await priceCart([{ productId: PRODUCT.id, qty: 3 }], true, {
      campaign: { id: "lp1", productId: PRODUCT.id, tiers: [] },
    });

    expect(empty.subtotal).toBe(plain.subtotal);
    expect(empty.total).toBe(plain.total);
    expect(empty.lines[0]!.unitPrice).toBe(plain.lines[0]!.unitPrice);
  });

  test("a tier moves the unit price, never the delivery or installation fee", async () => {
    const campaign = { id: "lp1", productId: PRODUCT.id, tiers: [{ minQty: 2, unitPrice: 2000 }] };

    const plain = await priceCart([{ productId: PRODUCT.id, qty: 2 }], true);
    const priced = await priceCart([{ productId: PRODUCT.id, qty: 2 }], true, { campaign });

    expect(priced.deliveryFee).toBe(plain.deliveryFee);
    expect(priced.installationFee).toBe(plain.installationFee);
    expect(priced.total).toBe(priced.subtotal + priced.deliveryFee! + priced.installationFee!);
  });
});
