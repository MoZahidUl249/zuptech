/**
 * One-off import: pulls the live product catalog from https://www.zupplus.com
 * (the production storefront) into the local dev database, for realistic
 * seed data. Idempotent — upserts by a stable id derived from the source's
 * own numeric product id, safe to re-run. Run with `bun run db:import:zupplus`.
 *
 * Notes / deliberate assumptions (site gives no field for these):
 *  - the breadcrumb's first crumb (Solar Panel, Security, KVM, …) is the
 *    merchandising category; it's upserted as a Category under the "Home"
 *    section, which is created if missing.
 *  - stock defaults to 20 when the listing doesn't show a "STOCK OUT" badge,
 *    0 when it does (visible mirrors that, like the ats63 seed row).
 *  - cost / minDp / delivery & installation fees default to 0 — not public
 *    data on the source site.
 *  - price/onSale/salePercentage are stored as scraped, unmodified — no
 *    checkout math happens here (see ../../fronend/cal-bk.md).
 */
import * as cheerio from "cheerio";
import { prisma } from "../src/lib/db";

const BASE = "https://www.zupplus.com";
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; ZupTechCatalogImport/1.0)" };
const DELAY_MS = 250;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toInt(text: string) {
  const digits = text.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

async function fetchHtml(url: string) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} fetching ${url}`);
  return cheerio.load(await res.text());
}

interface ListedProduct {
  url: string;
  sourceId: string;
  outOfStock: boolean;
}

async function collectListedProducts(): Promise<ListedProduct[]> {
  const found = new Map<string, ListedProduct>();

  const $first = await fetchHtml(`${BASE}/shop`);
  const totalMatch = $first("body")
    .text()
    .match(/Showing\s+\d+-\d+\s+of\s+(\d+)\s+Results/i);
  const total = totalMatch?.[1] ? parseInt(totalMatch[1], 10) : 0;
  const perPage = $first(".product_item").length || 36;
  const totalPages = total ? Math.max(1, Math.ceil(total / perPage)) : 1;
  console.log(`Catalog: ${total} products across ${totalPages} page(s)`);

  const scrapeCards = ($: cheerio.CheerioAPI) => {
    $(".product_item").each((_, el) => {
      const card = $(el);
      const href = card.find(".pro_img a[href]").first().attr("href");
      if (!href) return;
      const idMatch = href.match(/-(\d+)\/?$/);
      if (!idMatch?.[1]) return;
      const sourceId = idMatch[1];
      const outOfStock = card.find(".stock-out-overlay").length > 0;
      found.set(sourceId, { url: href, sourceId, outOfStock });
    });
  };

  scrapeCards($first);
  for (let page = 2; page <= totalPages; page++) {
    await sleep(DELAY_MS);
    const $page = await fetchHtml(`${BASE}/shop?page=${page}`);
    scrapeCards($page);
  }

  return [...found.values()];
}

function extractImages($: cheerio.CheerioAPI): string[] {
  const urls: string[] = [];
  $(".details_slider img.block__pic").each((_, el) => {
    const src = $(el).attr("src");
    if (src && !urls.includes(src)) urls.push(src);
  });
  $(".indicator_thumb img").each((_, el) => {
    const src = $(el).attr("src");
    if (src && !urls.includes(src)) urls.push(src);
  });
  return urls.slice(0, 3);
}

function extractSpecs($: cheerio.CheerioAPI): string[] {
  const specs: string[] = [];
  $("#description li").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text) specs.push(text);
  });
  if (specs.length === 0) {
    const paragraph = $("#description p").first().text().replace(/\s+/g, " ").trim();
    if (paragraph) specs.push(paragraph);
  }
  return specs;
}

async function scrapeProduct(listed: ListedProduct) {
  const $ = await fetchHtml(listed.url);

  const name = $(".details_right .product-cart p.name").first().text().trim();
  if (!name) throw new Error(`no name found on ${listed.url}`);

  const priceBlock = $(".details-price").first();
  const del = priceBlock.find("del").first().text();
  const newPrice = priceBlock.find("#newPrice").first().text();
  const regularPrice = toInt(del) || toInt(newPrice);
  const salePrice = toInt(newPrice) || regularPrice;
  const onSale = salePrice > 0 && salePrice < regularPrice;
  const salePercentage = onSale ? Math.round(((regularPrice - salePrice) / regularPrice) * 100) : 0;

  const productCode = $(".product-code p span")
    .first()
    .parent()
    .text()
    .replace(/.*:\s*/, "")
    .trim();

  const ratingText = $(".details-ratting-wrapper span").first().text();
  const rating = parseFloat(ratingText) || 0;

  const crumbs = $(".breadcrumb li a")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t && t.toLowerCase() !== "home");
  // The source has no hierarchy beyond the breadcrumb, so the first crumb is
  // the category; anything deeper is dropped rather than guessed at.
  const categoryName = crumbs[0]?.slice(0, 80) || "Uncategorized";

  const specs = extractSpecs($);
  const description = specs.join("; ");
  const photos = extractImages($);

  const id = `zp${listed.sourceId}`;
  const slug = `${slugify(name)}-zp${listed.sourceId}`;
  const sku = productCode ? `ZP-${productCode}` : `ZP-${listed.sourceId}`;
  const stock = listed.outOfStock ? 0 : 20;

  return {
    id,
    slug,
    name,
    categoryName,
    price: regularPrice,
    minDp: 0,
    onSale,
    salePercentage,
    rating,
    sold: 0,
    imgHint: "",
    specs: specs.slice(0, 6),
    description,
    video: "",
    sku,
    cost: 0,
    stock,
    reserved: 0,
    reorderAt: 5,
    visible: !listed.outOfStock,
    photos,
    deliveryFeeInsideDhaka: 0,
    deliveryFeeOutsideDhaka: 0,
    installationFeeInsideDhaka: 0,
    installationFeeOutsideDhaka: 0,
  };
}

async function main() {
  const listed = await collectListedProducts();
  console.log(`Found ${listed.length} product URLs. Fetching details…`);

  // Everything imported hangs off the "Home" section; categories are created
  // on first sight and cached so each name costs one round-trip at most.
  const section = await prisma.section.upsert({
    where: { name: "Home" },
    create: { name: "Home", sort: 0 },
    update: {},
  });
  const categoryIds = new Map<string, string>();
  async function categoryId(name: string): Promise<string> {
    const cached = categoryIds.get(name);
    if (cached) return cached;
    const category = await prisma.category.upsert({
      where: { name },
      create: { name, sectionId: section.id },
      update: {},
    });
    categoryIds.set(name, category.id);
    return category.id;
  }

  const failures: { url: string; error: string }[] = [];
  let imported = 0;

  for (const item of listed) {
    try {
      const { categoryName, ...scraped } = await scrapeProduct(item);
      const product = { ...scraped, categoryId: await categoryId(categoryName) };
      await prisma.product.upsert({
        where: { id: product.id },
        create: product,
        update: product,
      });
      imported++;
      console.log(`  ✔ ${product.name} (${product.id})`);
    } catch (err) {
      failures.push({ url: item.url, error: err instanceof Error ? err.message : String(err) });
      console.error(`  ✘ ${item.url}: ${err instanceof Error ? err.message : err}`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nImported ${imported}/${listed.length} products.`);
  if (failures.length) {
    console.log(`${failures.length} failures:`);
    for (const f of failures) console.log(`  - ${f.url}: ${f.error}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
