/**
 * Bulk dataset for load and performance testing.
 *
 * The demo seed is six products and a handful of orders, which is the right
 * size for clicking through the admin and useless for measuring anything: the
 * whole database fits in cache, every query is a sequential scan over nothing,
 * and `take: LIST_CAP` never engages. A load test against it measures the HTTP
 * stack and no part of the application.
 *
 * This adds a shop-shaped dataset on top: 5,000 products (ten times LIST_CAP,
 * so the cap and the missing pagination behind it become observable), 20,000
 * orders spread over eighteen months across every status, plus the customers,
 * leads, invoices and warranties that hang off them.
 *
 * Every row it writes is prefixed `sc-`, so `--wipe` removes exactly this and
 * leaves the demo seed untouched. Re-running without `--wipe` wipes first, so
 * the script converges rather than accumulating.
 *
 *   bun run prisma/seed-scale.ts          # build the dataset
 *   bun run prisma/seed-scale.ts --wipe   # remove it again
 *
 * Stock accounting is kept HONEST: `reserved` is derived from the orders in a
 * held state and `sold` from the delivered ones, exactly as
 * lib/order-stock.ts would have left them. A dataset that violates the
 * invariant would make the post-load integrity check meaningless, since it
 * could never tell a pre-existing inconsistency from one the load caused.
 */

import { prisma } from "../src/lib/db";
import { warrantyEndsAt } from "../src/lib/rules";

const PRODUCTS = 5_000;
const ORDERS = 20_000;
const CUSTOMERS = 2_000;
const LEADS = 3_000;
const INVOICES = 500;
const WARRANTIES = 800;

/** Postgres parameter limits make one huge createMany worse than several. */
const BATCH = 1_000;

/* ===== Deterministic randomness =====
 *
 * Seeded, so two runs produce the same dataset and a number from one load test
 * can be compared with a number from the next. `Math.random()` would make every
 * run a slightly different benchmark.
 */
function mulberry32(seed: number) {
  return function next(): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260807);
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

const pad = (n: number, width = 5) => String(n).padStart(width, "0");

const ADJECTIVES = ["Compact", "Heavy-duty", "Smart", "Silent", "Rapid", "Industrial", "Hybrid", "Solar"] as const;
const NOUNS = ["IPS", "Inverter", "Battery", "Stabilizer", "UPS", "Solar Panel", "Charger", "Controller"] as const;
const STATUSES = ["Processing", "Confirmed", "On the way", "Delivered", "Cancelled"] as const;
/** Mirrors STATE_OF in lib/order-stock.ts — these hold `reserved` units. */
const HELD = new Set(["Processing", "Confirmed", "On the way"]);

const MONTHS_OF_HISTORY = 18;

/** Insert in chunks, reporting as it goes — 20k rows is long enough to wonder. */
async function inChunks<T>(label: string, rows: T[], write: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await write(rows.slice(i, i + BATCH));
  }
  console.log(`  ${label.padEnd(14)} ${rows.length}`);
}

/**
 * Remove every row this script created.
 *
 * Order matters even with cascades declared: warranties reference order items,
 * invoices reference orders, and deleting a product still referenced by an
 * order item is a foreign-key error rather than a cascade. Deleting the orders
 * first takes the items with them, which is what frees the products.
 */
async function wipe() {
  console.log("Removing the scale dataset…");
  const scoped = { id: { startsWith: "sc-" } };

  const w = await prisma.warranty.deleteMany({ where: scoped });
  const i = await prisma.invoice.deleteMany({ where: scoped });
  const l = await prisma.serviceLead.deleteMany({ where: scoped });
  // Cascades to OrderItem and OrderEvent.
  const o = await prisma.order.deleteMany({ where: scoped });
  const p = await prisma.product.deleteMany({ where: scoped });
  const c = await prisma.customer.deleteMany({ where: scoped });

  console.log(
    `  removed ${p.count} products, ${o.count} orders, ${c.count} customers, ` +
      `${l.count} leads, ${i.count} invoices, ${w.count} warranties`,
  );
}

async function main() {
  if (process.argv.includes("--wipe")) {
    await wipe();
    return;
  }

  // Converge rather than accumulate: a second run must not double the dataset.
  await wipe();

  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  if (categories.length === 0) {
    throw new Error("No categories — run `bun run db:seed` first, this seed builds on top of it.");
  }
  const services = await prisma.service.findMany({ select: { id: true } });

  console.log(`Building the scale dataset across ${categories.length} categories…`);
  const started = Date.now();

  /* ===== Products ===== */

  const products = Array.from({ length: PRODUCTS }, (_, n) => {
    const price = between(8, 900) * 100; // ৳800–৳90,000, round hundreds
    const onSale = rand() < 0.25;
    return {
      id: `sc-p-${pad(n)}`,
      slug: `sc-product-${pad(n)}`,
      name: `${pick(ADJECTIVES)} ${pick(NOUNS)} ${1000 + between(0, 8999)}VA`,
      sku: `ZT-SC-${pad(n)}`,
      categoryId: pick(categories).id,
      price,
      // Sale price has to stay strictly below list or sellingPrice() ignores
      // it, and a dataset where a quarter of the "sales" are inert would
      // quietly halve the discount path's share of the load.
      onSale,
      salePrice: onSale ? Math.round(price * 0.85) : 0,
      minDeposit: rand() < 0.3 ? Math.round(price * 0.2) : 0,
      cost: Math.round(price * 0.7),
      stock: between(0, 400),
      reserved: 0, // recomputed from the orders below
      sold: 0, //     ditto
      reorderAt: between(2, 25),
      rating: Math.round(rand() * 50) / 10,
      visible: rand() < 0.9, // a tenth hidden, so orderableProductWhere() has work to do
      warrantyMonths: pick([0, 6, 12, 24, 36]),
      description: "Generated for load testing. Not a real product.",
      specs: ["Load-test fixture", `Rated ${between(1, 10)}kVA`, "Pure sine wave", "2-year service"],
      imgHint: "load test fixture",
      deliveryFeeInsideDhaka: between(0, 4) * 50,
      deliveryFeeOutsideDhaka: between(2, 10) * 50,
      installationFeeInsideDhaka: between(0, 6) * 100,
      installationFeeOutsideDhaka: between(0, 10) * 100,
    };
  });

  await inChunks("products", products, (chunk) =>
    prisma.product.createMany({ data: chunk, skipDuplicates: true }),
  );

  // Offer ladders on a fifth of the catalogue, so bestOfferTier() is exercised
  // by a realistic minority of cart lines rather than all or none.
  const quantityTiers: { productId: string; minQty: number; amount: number }[] = [];
  const deliveryTiers: { productId: string; minQty: number; amount: number }[] = [];
  for (const p of products) {
    if (rand() >= 0.2) continue;
    quantityTiers.push({ productId: p.id, minQty: 3, amount: Math.round(p.price * 0.05) });
    quantityTiers.push({ productId: p.id, minQty: 10, amount: Math.round(p.price * 0.12) });
    if (rand() < 0.5) {
      deliveryTiers.push({ productId: p.id, minQty: 5, amount: p.deliveryFeeInsideDhaka });
    }
  }
  await inChunks("qty tiers", quantityTiers, (chunk) =>
    prisma.quantityOffer.createMany({ data: chunk, skipDuplicates: true }),
  );
  await inChunks("delivery tiers", deliveryTiers, (chunk) =>
    prisma.freeDeliveryOffer.createMany({ data: chunk, skipDuplicates: true }),
  );

  /* ===== Customers ===== */

  const customers = Array.from({ length: CUSTOMERS }, (_, n) => ({
    id: `sc-c-${pad(n)}`,
    name: `Load Test Customer ${pad(n)}`,
    // 0199 + 7 digits keeps these clear of the demo seed's numbers while
    // still matching PHONE_RE, so they behave like real accounts.
    phone: `0199${pad(n, 7)}`,
    email: `sc-customer-${pad(n)}@loadtest.invalid`,
    address: `House ${between(1, 200)}, Road ${between(1, 30)}, Dhaka`,
    insideDhaka: rand() < 0.65,
  }));
  await inChunks("customers", customers, (chunk) =>
    prisma.customer.createMany({ data: chunk, skipDuplicates: true }),
  );

  /* ===== Orders ===== */

  const now = Date.now();
  const historyMs = MONTHS_OF_HISTORY * 30 * 24 * 60 * 60 * 1000;

  // Accumulated as the orders are built, then written back to the products, so
  // stock/reserved/sold reconcile the way applyStatusTransition would leave them.
  const reservedBy = new Map<string, number>();
  const soldBy = new Map<string, number>();

  const orderRows: {
    id: string;
    number: number;
    customerId: string;
    name: string;
    phone: string;
    address: string;
    insideDhaka: boolean;
    subtotal: number;
    deliveryFee: number;
    installationFee: number;
    total: number;
    pay: string;
    status: string;
    createdAt: Date;
  }[] = [];
  const itemRows: {
    orderId: string;
    productId: string;
    qty: number;
    unitPrice: number;
    deliveryFee: number;
    installationFee: number;
  }[] = [];

  for (let n = 0; n < ORDERS; n++) {
    const id = `sc-o-${pad(n)}`;
    const customer = customers[between(0, customers.length - 1)]!;
    const status = pick(STATUSES);
    const insideDhaka = rand() < 0.65;
    const createdAt = new Date(now - Math.floor(rand() * historyMs));

    let subtotal = 0;
    let deliveryFee = 0;
    let installationFee = 0;

    const lines = between(1, 4);
    const used = new Set<string>();
    for (let l = 0; l < lines; l++) {
      const product = products[between(0, products.length - 1)]!;
      if (used.has(product.id)) continue; // one line per product, as priceCart merges them
      used.add(product.id);

      const qty = between(1, 5);
      // Sale price only; no quantity tier is applied here. Historical orders
      // freeze whatever they were charged, and re-deriving tiers now would
      // invent history the pricing engine never produced.
      const unitPrice = product.onSale ? product.salePrice : product.price;
      const unitDelivery = insideDhaka ? product.deliveryFeeInsideDhaka : product.deliveryFeeOutsideDhaka;
      const unitInstall = insideDhaka
        ? product.installationFeeInsideDhaka
        : product.installationFeeOutsideDhaka;

      subtotal += unitPrice * qty;
      deliveryFee += unitDelivery * qty;
      installationFee += unitInstall * qty;

      itemRows.push({
        orderId: id,
        productId: product.id,
        qty,
        unitPrice,
        deliveryFee: unitDelivery,
        installationFee: unitInstall,
      });

      if (HELD.has(status)) reservedBy.set(product.id, (reservedBy.get(product.id) ?? 0) + qty);
      if (status === "Delivered") soldBy.set(product.id, (soldBy.get(product.id) ?? 0) + qty);
    }

    orderRows.push({
      id,
      // Well clear of the demo orders and of the `order` counter (10241), so a
      // real checkout during the load test can't collide with a fixture.
      number: 900_000 + n,
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: `${customer.address}, ${insideDhaka ? "Inside Dhaka" : "Outside Dhaka"}`,
      insideDhaka,
      subtotal,
      deliveryFee,
      installationFee,
      total: subtotal + deliveryFee + installationFee,
      pay: pick(["Cash on delivery", "bKash", "Nagad"]),
      status,
      createdAt,
    });
  }

  await inChunks("orders", orderRows, (chunk) =>
    prisma.order.createMany({ data: chunk, skipDuplicates: true }),
  );
  await inChunks("order items", itemRows, (chunk) =>
    prisma.orderItem.createMany({ data: chunk, skipDuplicates: true }),
  );

  /* ===== Reconcile stock =====
   *
   * One UPDATE per product that has any, rather than 5,000 no-op updates.
   */
  const touched = new Set([...reservedBy.keys(), ...soldBy.keys()]);
  let reconciled = 0;
  for (const productId of touched) {
    const reserved = reservedBy.get(productId) ?? 0;
    const sold = soldBy.get(productId) ?? 0;
    await prisma.product.update({
      where: { id: productId },
      // Held units must actually exist, or availableStock() clamps to 0 and
      // the catalogue reads as sold out everywhere.
      data: { reserved, sold, stock: { increment: reserved } },
    });
    reconciled++;
  }
  console.log(`  ${"stock".padEnd(14)} reconciled across ${reconciled} products`);

  /* ===== Invoices, warranties, leads ===== */

  const delivered = orderRows.filter((o) => o.status === "Delivered");

  const invoices = delivered.slice(0, INVOICES).map((o, n) => ({
    id: `sc-i-${pad(n)}`,
    number: 900_000 + n,
    orderId: o.id,
    status: pick(["Draft", "Issued", "Paid"]),
    issuedAt: o.createdAt,
    notes: "",
  }));
  await inChunks("invoices", invoices, (chunk) =>
    prisma.invoice.createMany({ data: chunk, skipDuplicates: true }),
  );

  // Warranties hang off a specific OrderItem (unique), so the ids have to come
  // back from the database — they are autoincrement, not something we chose.
  const warrantyOrderIds = delivered.slice(0, WARRANTIES).map((o) => o.id);
  const warrantyItems = await prisma.orderItem.findMany({
    where: { orderId: { in: warrantyOrderIds } },
    select: { id: true, orderId: true, productId: true, qty: true },
    take: WARRANTIES,
  });
  const productById = new Map(products.map((p) => [p.id, p]));
  const warranties = warrantyItems.map((item, n) => {
    const product = productById.get(item.productId)!;
    const months = product.warrantyMonths || 12;
    const startsAt = new Date(now - Math.floor(rand() * historyMs));
    return {
      id: `sc-w-${pad(n)}`,
      number: 900_000 + n,
      orderId: item.orderId,
      orderItemId: item.id,
      productId: item.productId,
      sku: product.sku,
      qty: item.qty,
      months,
      startsAt,
      endsAt: warrantyEndsAt(startsAt, months),
      status: "Active",
    };
  });
  await inChunks("warranties", warranties, (chunk) =>
    prisma.warranty.createMany({ data: chunk, skipDuplicates: true }),
  );

  if (services.length > 0) {
    const leads = Array.from({ length: LEADS }, (_, n) => ({
      id: `sc-l-${pad(n)}`,
      serviceId: pick(services).id,
      customer: `Load Test Enquiry ${pad(n)}`,
      phone: `0198${pad(n, 7)}`,
      email: `sc-lead-${pad(n)}@loadtest.invalid`,
      address: `Road ${between(1, 30)}, Dhaka`,
      notes: "Generated for load testing.",
      status: pick(["New", "Contacted", "Survey booked", "Quoted", "Won", "Lost"]),
      createdAt: new Date(now - Math.floor(rand() * historyMs)),
    }));
    await inChunks("leads", leads, (chunk) =>
      prisma.serviceLead.createMany({ data: chunk, skipDuplicates: true }),
    );
  } else {
    console.log("  leads          skipped (no services seeded)");
  }

  console.log(`\nDone in ${Math.round((Date.now() - started) / 1000)}s.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
