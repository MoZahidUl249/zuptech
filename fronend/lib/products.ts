export type ProductCategory = "Home" | "Industrial";
// Tags are admin-managed (see components/admin/section-products.tsx) and
// open-ended, not a fixed set — the shop's tag filter builds its options
// from whatever tags the live catalog actually has.
export type ProductTag = string;

/** One quantity-discount tier: buy `minQty`+ and `amount` (BDT) comes off each
 *  unit. */
export interface QuantityOffer {
  minQty: number;
  amount: number;
}

/** One free-delivery tier: buy `minQty`+ and `amount` (BDT) comes off the
 *  delivery fee. An amount at or above the fee means the line ships free. */
export interface FreeDeliveryOffer {
  minQty: number;
  amount: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  /** Minimum down payment as a whole percent of price (0–100). Display-only —
   *  nothing in the cart or checkout reads it. */
  minDepositPct: number;
  /** Curated products shown under this one, in this order. Ids only; the page
   *  resolves them through getProductsByIds. Empty hides the row. */
  recommendedIds?: string[];
  /** The admin-typed discount, 0–100 — a LABEL only. `salePrice` is the money
   *  and was already resolved from this server-side; nothing here multiplies. */
  salePct?: number;
  /** Resolved status label: "" | "Out of stock" | "Incoming" | "Sold out".
   *  The manual override and the stock derivation are both applied server-side
   *  (stockTagFor), so the card prints this verbatim. */
  stockTag?: string;
  rating: number;
  sold: number;
  imgHint: string;
  specs: string[];
  description: string;

  /* Taxonomy. The live API returns category/section (Section → Category →
   * Product); `cat`/`tags` are the older flat shape kept by the bundled seed
   * below, so both sides are optional and readers fall back between them. */
  cat?: ProductCategory;
  tags?: ProductTag[];
  category?: string;
  categoryLogo?: string;
  section?: string;

  /* Fields served by the backend (GET /api/products); absent on the bundled
   * fallback seed below, so they are optional. */
  photos?: string[];
  video?: string;
  /** Units available to order (stock − reserved). */
  available?: number;
  inStock?: boolean;

  /* Pricing inputs. Display-only — the charged amount always comes from
   * POST /api/pricing/quote (see cal-bk.md). These let the UI explain *why* a
   * price is what it is: strike-through, "you save", offer tiers, free
   * delivery thresholds. */
  onSale?: boolean;
  /** What the customer pays. Admin-entered while on sale, otherwise equal to
   *  `price` — the server resolves it, the client never derives it. */
  salePrice?: number;
  quantityOffers?: QuantityOffer[];
  deliveryFeeInsideDhaka?: number;
  deliveryFeeOutsideDhaka?: number;
  installationFeeInsideDhaka?: number;
  installationFeeOutsideDhaka?: number;
  freeDeliveryOffers?: FreeDeliveryOffer[];
}

/*
 * Taxonomy accessors. The catalog reaches the UI in two shapes — the live API's
 * Section → Category → Product, and the flat `cat`/`tags` of the bundled seed
 * below — so read taxonomy through these rather than either field directly.
 */

/** "Home" | "Industrial", from whichever shape the product came in. */
export function productSection(p: Product): string | undefined {
  return p.section ?? p.cat;
}

/** Filterable labels for a product (its category, or its legacy tag list). */
export function productTags(p: Product): string[] {
  if (p.tags?.length) return p.tags;
  return p.category ? [p.category] : [];
}

/**
 * Bundled fallback catalog — used only when the backend is unreachable
 * (lib/api.ts). Display-only: all charged amounts are always computed by the
 * backend at quote/order time (see cal-bk.md).
 */
export const products: Product[] = [
  {
    id: "ips1000",
    slug: "1000va-ips-battery-combo",
    name: "1000VA IPS + Battery Combo",
    cat: "Home",
    tags: ["Backup"],
    price: 42500,
    minDepositPct: 20,
    rating: 4.7,
    sold: 312,
    imgHint: "IPS unit photo",
    specs: [
      "1000VA / 800W pure sine-wave output",
      "Includes 100Ah tubular battery",
      "6–8 hr backup for fans, lights & Wi-Fi",
      "1-year service warranty, Dhaka-wide install",
    ],
    description:
      "A complete home backup package: a 1000VA pure sine-wave IPS paired with a 100Ah tubular battery, sized to run fans, lights and Wi-Fi for 6–8 hours per outage. Installed Dhaka-wide with a 1-year service warranty.",
  },
  {
    id: "solar500",
    slug: "solar-home-system-500w",
    name: "Solar Home System 500W",
    cat: "Home",
    tags: ["Solar"],
    price: 55000,
    minDepositPct: 25,
    rating: 4.8,
    sold: 189,
    imgHint: "solar panel kit photo",
    specs: [
      "500W mono panels + hybrid inverter",
      "Runs TV, lights, fans daytime free",
      "Net-metering ready",
      "Installed by certified engineers",
    ],
    description:
      "A 500W monocrystalline solar home system with hybrid inverter — run your TV, lights and fans on free daytime power. Net-metering ready and installed end-to-end by certified ZUP TECH engineers.",
  },
  {
    id: "stab30",
    slug: "3-phase-voltage-stabilizer-30kva",
    name: "3-Phase Voltage Stabilizer 30 kVA",
    cat: "Industrial",
    tags: ["Protection"],
    price: 92000,
    minDepositPct: 30,
    rating: 4.6,
    sold: 74,
    imgHint: "stabilizer photo",
    specs: [
      "Servo type, 30 kVA, 3-phase",
      "Input range 280–460V",
      "Protects CNC, compressors, chillers",
      "On-site commissioning included",
    ],
    description:
      "Servo-type 30 kVA three-phase voltage stabilizer with a wide 280–460V input range. Protects sensitive industrial machinery — CNC machines, compressors and chillers — with on-site commissioning included.",
  },
  {
    id: "trafo200",
    slug: "200kva-distribution-transformer",
    name: "200 kVA Distribution Transformer",
    cat: "Industrial",
    tags: ["Switchgear"],
    price: 485000,
    minDepositPct: 40,
    rating: 4.9,
    sold: 41,
    imgHint: "transformer photo",
    specs: [
      "11/0.415 kV, 200 kVA, ONAN",
      "BSTI & REB spec compliant",
      "Copper wound, low-loss core",
      "Delivery + crane placement included",
    ],
    description:
      "An 11/0.415 kV, 200 kVA ONAN distribution transformer built to BSTI and REB specifications. Copper wound with a low-loss core — delivery and crane placement are included in the price.",
  },
  {
    id: "panelLT",
    slug: "lt-switchgear-panel-custom",
    name: "LT Switchgear Panel (Custom)",
    cat: "Industrial",
    tags: ["Switchgear"],
    price: 145000,
    minDepositPct: 35,
    rating: 4.7,
    sold: 58,
    imgHint: "LT panel photo",
    specs: [
      "Custom-built to your load schedule",
      "Reputed-brand breakers & meters",
      "Powder-coated IP54 enclosure",
      "Drawings approved before build",
    ],
    description:
      "A low-tension switchgear panel custom-built to your exact load schedule, using reputed-brand breakers and meters in a powder-coated IP54 enclosure. You approve the drawings before we build.",
  },
  {
    id: "solar10k",
    slug: "industrial-solar-kit-10kw",
    name: "Industrial Solar Kit 10 kW",
    cat: "Industrial",
    tags: ["Solar"],
    price: 620000,
    minDepositPct: 40,
    rating: 4.8,
    sold: 23,
    imgHint: "rooftop solar photo",
    specs: [
      "10 kW on-grid, tier-1 panels",
      "Payback typically under 4 years",
      "Full EPC: design → commissioning",
      "Generation monitoring app",
    ],
    description:
      "A 10 kW on-grid industrial solar kit with tier-1 panels and full EPC delivery — design through commissioning — plus a generation monitoring app. Payback is typically under 4 years.",
  },
  {
    id: "ats63",
    slug: "automatic-transfer-switch-63a",
    name: "Automatic Transfer Switch 63A",
    cat: "Home",
    tags: ["Backup", "Protection"],
    price: 12800,
    minDepositPct: 10,
    rating: 4.5,
    sold: 146,
    imgHint: "ATS photo",
    specs: [
      "Seamless mains ↔ generator switching",
      "63A, 2-pole, DIN mount",
      "Under 20ms transfer time",
      "Installation service available",
    ],
    description:
      "A 63A two-pole automatic transfer switch for seamless switching between mains and generator power, with under-20ms transfer time. DIN-mount design; professional installation available.",
  },
  {
    id: "vprot",
    slug: "voltage-protector-220v-40a",
    name: "Voltage Protector 220V 40A",
    cat: "Home",
    tags: ["Protection"],
    price: 1650,
    minDepositPct: 10,
    rating: 4.6,
    sold: 921,
    imgHint: "voltage protector photo",
    specs: [
      "Cuts off on high/low voltage",
      "Protects fridge, AC, TV",
      "Auto-reconnect with delay",
      "Plug-and-play install",
    ],
    description:
      "A 220V 40A voltage protector that cuts power instantly on dangerous high or low voltage, protecting your fridge, AC and TV. Auto-reconnects with a safe delay — plug-and-play installation.",
  },
  {
    id: "flood100",
    slug: "led-flood-light-100w-ip66",
    name: "LED Flood Light 100W IP66",
    cat: "Home",
    tags: ["Lighting"],
    price: 2400,
    minDepositPct: 10,
    rating: 4.4,
    sold: 534,
    imgHint: "flood light photo",
    specs: [
      "100W, 10,000 lumen, 6500K",
      "IP66 weatherproof",
      "50,000 hr lifespan",
      "2-year replacement warranty",
    ],
    description:
      "A 100W LED flood light delivering 10,000 lumens at 6500K in an IP66 weatherproof housing. Rated for 50,000 hours and backed by a 2-year replacement warranty.",
  },
  {
    id: "mccb400",
    slug: "mccb-breaker-400a-3-pole",
    name: "MCCB Breaker 400A 3-Pole",
    cat: "Industrial",
    tags: ["Protection", "Switchgear"],
    price: 18500,
    minDepositPct: 15,
    rating: 4.7,
    sold: 203,
    imgHint: "MCCB photo",
    specs: [
      "400A frame, 36kA breaking capacity",
      "Adjustable thermal-magnetic trip",
      "Panel or DIN mounting",
      "Genuine, with test certificate",
    ],
    description:
      "A genuine 400A three-pole MCCB with 36kA breaking capacity and adjustable thermal-magnetic trip. Suitable for panel or DIN mounting, supplied with test certificate.",
  },
];

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getRelated(product: Product, count = 4): Product[] {
  return products
    .filter((p) => p.id !== product.id && p.cat === product.cat)
    .slice(0, count);
}

export const featuredProducts: Product[] = [
  products[0],
  products[1],
  products[3],
  products[7],
  products[2],
  products[5],
  products[8],
  products[9],
];

/**
 * Whether this product may be bought.
 *
 * Two facts make a product unbuyable and they arrive on different fields:
 * `inStock` (derived from stock − reserved) and a `stockTag` the admin has
 * pinned to "Sold out" for a line that is finished for good. A pinned product
 * can still report `inStock: true` — there may be units on the shelf that are
 * deliberately not for sale — so a check on `inStock` alone keeps selling it.
 *
 * This lives here because the rule had drifted: the product page honoured the
 * pin in its status line while ProductActions, deriving the same fact from
 * `inStock` alone, went on rendering Buy Now beneath the words "Sold out".
 * Every reader must ask this function, not the fields.
 *
 * "Incoming" deliberately still sells — stock is on the way, and taking the
 * order is the point of saying so.
 */
export function isUnavailable(p: Pick<Product, "inStock" | "stockTag">): boolean {
  return p.inStock === false || p.stockTag === "Sold out";
}
