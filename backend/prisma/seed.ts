/**
 * Seed: ports the frontend demo data (lib/products.ts + seedState() in
 * lib/admin.tsx) so the site keeps working unchanged against the real API.
 *
 * Idempotent: safe to re-run — rows are upserted, staff auth users are only
 * created when missing. Run with `bun run db:seed`.
 */
import { randomBytes } from "node:crypto";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/db";
import { ADMIN_MODULES, type AdminModule, type Permission } from "../src/lib/rbac";
import { staffEmail } from "../src/lib/rules";

/* ===== Roles ===== */

function perms(view: AdminModule[] = [], manage: AdminModule[] = []) {
  const p = {} as Record<AdminModule, Permission>;
  for (const m of ADMIN_MODULES) {
    p[m] = manage.includes(m) ? "manage" : view.includes(m) ? "view" : "none";
  }
  return p;
}

const roles = [
  { id: "super", name: "Super Admin", isSystem: true, permissions: perms([], [...ADMIN_MODULES]) },
  {
    id: "manager",
    name: "Manager",
    isSystem: false,
    permissions: perms(
      ["dashboard", "analytics", "customers", "payments"],
      [
        "orders",
        "invoices",
        "warranty",
        "products",
        "inventory",
        "leads",
        "homepage",
        "landingpages",
        "sitecontent",
      ],
    ),
  },
  {
    id: "support",
    name: "Support",
    isSystem: false,
    permissions: perms(
      ["dashboard", "products", "customers", "invoices"],
      ["orders", "warranty", "leads"],
    ),
  },
];

/* ===== Staff ===== */

/**
 * The password new staff rows are created with.
 *
 * In development every account gets `zup123`, which is what the login screen
 * hints at and what the docs tell you to sign in with. In production that
 * would hand anyone who has read this repo three working admin logins, so the
 * seed generates a random password instead and prints it once — the operator
 * copies it out of the deploy log and changes it, rather than being trusted to
 * remember a manual step nothing enforces. `SEED_DEMO_PASSWORD=true` opts back
 * in for a throwaway staging box.
 */
function staffPassword(): string {
  const demo =
    process.env.NODE_ENV !== "production" || process.env.SEED_DEMO_PASSWORD === "true";
  return demo ? "zup123" : `zup-${randomBytes(12).toString("base64url")}`;
}

// `email` is the real, deliverable address a password-reset OTP goes to — not
// the synthetic `{username}@staff.zuptech.local` Better Auth signs in with.
const staff = [
  { name: "Arif Hossain", phone: "01711-000001", email: "arif@zuptech.example", username: "arif", roleId: "super" },
  { name: "Nusrat Jahan", phone: "01822-000002", email: "nusrat@zuptech.example", username: "nusrat", roleId: "manager" },
  { name: "Rakib Khan", phone: "01933-000003", email: "rakib@zuptech.example", username: "rakib", roleId: "support" },
];

/* ===== Catalog taxonomy (Section → Category → Product) ===== */

const sections = [
  { name: "Home", sort: 0 },
  { name: "Industrial", sort: 1 },
];

// Category names are globally unique, so each belongs to exactly one section.
const categories = [
  { name: "Backup", section: "Home", sort: 0 },
  { name: "Lighting", section: "Home", sort: 1 },
  { name: "Protection", section: "Industrial", sort: 0 },
  { name: "Solar", section: "Industrial", sort: 1 },
  { name: "Switchgear", section: "Industrial", sort: 2 },
];

/* ===== Products (storefront + admin fields merged) ===== */

// `category` is the Category *name*; it's resolved to an id at write time so
// the seed doesn't depend on cuids that differ between environments.
// prettier-ignore
const products = [
  { id: "ips1000", slug: "1000va-ips-battery-combo", name: "1000VA IPS + Battery Combo", category: "Backup", price: 42500, minDepositPct: 20, rating: 4.7, sold: 312, imgHint: "IPS unit photo", specs: ["1000VA / 800W pure sine-wave output", "Includes 100Ah tubular battery", "6–8 hr backup for fans, lights & Wi-Fi", "1-year service warranty, Dhaka-wide install"], description: "A complete home backup package: a 1000VA pure sine-wave IPS paired with a 100Ah tubular battery, sized to run fans, lights and Wi-Fi for 6–8 hours per outage. Installed Dhaka-wide with a 1-year service warranty.", video: "https://www.youtube.com/watch?v=ips1000demo", sku: "ZT-IPS-1000", cost: 34000, stock: 14, reserved: 2, reorderAt: 5, visible: true, deliveryFeeInsideDhaka: 150, deliveryFeeOutsideDhaka: 350, installationFeeInsideDhaka: 500, installationFeeOutsideDhaka: 800, recommendedIds: ["ats63", "solar500", "vprot"], warrantyMonths: 12 },
  { id: "solar500", slug: "solar-home-system-500w", name: "Solar Home System 500W", category: "Solar", price: 55000, minDepositPct: 25, rating: 4.8, sold: 189, imgHint: "solar panel kit photo", specs: ["500W mono panels + hybrid inverter", "Runs TV, lights, fans daytime free", "Net-metering ready", "Installed by certified engineers"], description: "A 500W monocrystalline solar home system with hybrid inverter — run your TV, lights and fans on free daytime power. Net-metering ready and installed end-to-end by certified ZUP TECH engineers.", sku: "ZT-SHS-500", cost: 45000, stock: 8, reserved: 1, reorderAt: 4, visible: true, deliveryFeeInsideDhaka: 300, deliveryFeeOutsideDhaka: 600, installationFeeInsideDhaka: 1500, installationFeeOutsideDhaka: 2500, recommendedIds: ["solar10k", "ips1000", "flood100"], warrantyMonths: 60 },
  { id: "stab30", slug: "3-phase-voltage-stabilizer-30kva", name: "3-Phase Voltage Stabilizer 30 kVA", category: "Protection", price: 92000, minDepositPct: 30, rating: 4.6, sold: 74, imgHint: "stabilizer photo", specs: ["Servo type, 30 kVA, 3-phase", "Input range 280–460V", "Protects CNC, compressors, chillers", "On-site commissioning included"], description: "Servo-type 30 kVA three-phase voltage stabilizer with a wide 280–460V input range. Protects sensitive industrial machinery — CNC machines, compressors and chillers — with on-site commissioning included.", sku: "ZT-STB-30K", cost: 76000, stock: 3, reserved: 0, reorderAt: 3, visible: true, deliveryFeeInsideDhaka: 800, deliveryFeeOutsideDhaka: 1800, installationFeeInsideDhaka: 3000, installationFeeOutsideDhaka: 5000, recommendedIds: ["vprot", "mccb400", "panelLT"], warrantyMonths: 24 },
  { id: "trafo200", slug: "200kva-distribution-transformer", name: "200 kVA Distribution Transformer", category: "Switchgear", price: 485000, minDepositPct: 40, rating: 4.9, sold: 41, imgHint: "transformer photo", specs: ["11/0.415 kV, 200 kVA, ONAN", "BSTI & REB spec compliant", "Copper wound, low-loss core", "Delivery + crane placement included"], description: "An 11/0.415 kV, 200 kVA ONAN distribution transformer built to BSTI and REB specifications. Copper wound with a low-loss core — delivery and crane placement are included in the price.", sku: "ZT-TRF-200", cost: 410000, stock: 2, reserved: 1, reorderAt: 2, visible: true, deliveryFeeInsideDhaka: 3000, deliveryFeeOutsideDhaka: 8000, installationFeeInsideDhaka: 10000, installationFeeOutsideDhaka: 18000, recommendedIds: ["panelLT", "mccb400", "stab30"], warrantyMonths: 60 },
  { id: "panelLT", slug: "lt-switchgear-panel-custom", name: "LT Switchgear Panel (Custom)", category: "Switchgear", price: 145000, minDepositPct: 35, rating: 4.7, sold: 58, imgHint: "LT panel photo", specs: ["Custom-built to your load schedule", "Reputed-brand breakers & meters", "Powder-coated IP54 enclosure", "Drawings approved before build"], description: "A low-tension switchgear panel custom-built to your exact load schedule, using reputed-brand breakers and meters in a powder-coated IP54 enclosure. You approve the drawings before we build.", sku: "ZT-PNL-LT", cost: 112000, stock: 5, reserved: 0, reorderAt: 2, visible: true, deliveryFeeInsideDhaka: 1000, deliveryFeeOutsideDhaka: 2500, installationFeeInsideDhaka: 4000, installationFeeOutsideDhaka: 7000, recommendedIds: ["mccb400", "trafo200", "stab30"], warrantyMonths: 24 },
  { id: "solar10k", slug: "industrial-solar-kit-10kw", name: "Industrial Solar Kit 10 kW", category: "Solar", price: 620000, minDepositPct: 40, rating: 4.8, sold: 23, imgHint: "rooftop solar photo", specs: ["10 kW on-grid, tier-1 panels", "Payback typically under 4 years", "Full EPC: design → commissioning", "Generation monitoring app"], description: "A 10 kW on-grid industrial solar kit with tier-1 panels and full EPC delivery — design through commissioning — plus a generation monitoring app. Payback is typically under 4 years.", sku: "ZT-SOL-10K", cost: 520000, stock: 4, reserved: 1, reorderAt: 2, visible: true, deliveryFeeInsideDhaka: 2000, deliveryFeeOutsideDhaka: 5000, installationFeeInsideDhaka: 15000, installationFeeOutsideDhaka: 25000, recommendedIds: ["solar500", "panelLT", "trafo200"], warrantyMonths: 60 },
  { id: "ats63", slug: "automatic-transfer-switch-63a", name: "Automatic Transfer Switch 63A", category: "Backup", price: 12800, minDepositPct: 10, rating: 4.5, sold: 146, imgHint: "ATS photo", specs: ["Seamless mains ↔ generator switching", "63A, 2-pole, DIN mount", "Under 20ms transfer time", "Installation service available"], description: "A 63A two-pole automatic transfer switch for seamless switching between mains and generator power, with under-20ms transfer time. DIN-mount design; professional installation available.", sku: "ZT-ATS-63", cost: 10500, stock: 0, reserved: 0, reorderAt: 6, visible: false, deliveryFeeInsideDhaka: 100, deliveryFeeOutsideDhaka: 250, installationFeeInsideDhaka: 300, installationFeeOutsideDhaka: 500, recommendedIds: ["ips1000", "stab30", "vprot"], warrantyMonths: 12 },
  { id: "vprot", slug: "voltage-protector-220v-40a", name: "Voltage Protector 220V 40A", category: "Protection", price: 1650, minDepositPct: 10, rating: 4.6, sold: 921, imgHint: "voltage protector photo", specs: ["Cuts off on high/low voltage", "Protects fridge, AC, TV", "Auto-reconnect with delay", "Plug-and-play install"], description: "A 220V 40A voltage protector that cuts power instantly on dangerous high or low voltage, protecting your fridge, AC and TV. Auto-reconnects with a safe delay — plug-and-play installation.", sku: "ZT-VPR-40", cost: 1100, stock: 230, reserved: 12, reorderAt: 50, visible: true, deliveryFeeInsideDhaka: 60, deliveryFeeOutsideDhaka: 150, installationFeeInsideDhaka: 0, installationFeeOutsideDhaka: 0, recommendedIds: ["mccb400", "flood100", "stab30"], warrantyMonths: 12 },
  { id: "flood100", slug: "led-flood-light-100w-ip66", name: "LED Flood Light 100W IP66", category: "Lighting", price: 2400, minDepositPct: 10, rating: 4.4, sold: 534, imgHint: "flood light photo", specs: ["100W, 10,000 lumen, 6500K", "IP66 weatherproof", "50,000 hr lifespan", "2-year replacement warranty"], description: "A 100W LED flood light delivering 10,000 lumens at 6500K in an IP66 weatherproof housing. Rated for 50,000 hours and backed by a 2-year replacement warranty.", sku: "ZT-FLD-100", cost: 1700, stock: 96, reserved: 4, reorderAt: 30, visible: true, deliveryFeeInsideDhaka: 80, deliveryFeeOutsideDhaka: 200, installationFeeInsideDhaka: 100, installationFeeOutsideDhaka: 200, recommendedIds: ["vprot", "solar500", "ats63"], warrantyMonths: 24 },
  { id: "mccb400", slug: "mccb-breaker-400a-3-pole", name: "MCCB Breaker 400A 3-Pole", category: "Protection", price: 18500, minDepositPct: 15, rating: 4.7, sold: 203, imgHint: "MCCB photo", specs: ["400A frame, 36kA breaking capacity", "Adjustable thermal-magnetic trip", "Panel or DIN mounting", "Genuine, with test certificate"], description: "A genuine 400A three-pole MCCB with 36kA breaking capacity and adjustable thermal-magnetic trip. Suitable for panel or DIN mounting, supplied with test certificate.", sku: "ZT-MCB-400", cost: 14200, stock: 41, reserved: 0, reorderAt: 10, visible: true, deliveryFeeInsideDhaka: 150, deliveryFeeOutsideDhaka: 400, installationFeeInsideDhaka: 400, installationFeeOutsideDhaka: 700, recommendedIds: ["stab30", "panelLT", "vprot"], warrantyMonths: 12 },
];

/* ===== Offer ladders =====
 *
 * Both tier kinds are relations, so they're written after the products exist.
 * Keyed by product id; the highest satisfied minQty wins and tiers never stack
 * (see rules.ts `bestQuantityOffer` / `deliveryDiscountAmount`). Amounts are
 * flat BDT: off the unit price for `quantity`, off the zone delivery fee for
 * `delivery` — where an amount at or above the fee means the line ships free.
 */

const offers: Record<
  string,
  {
    quantity?: { minQty: number; amount: number }[];
    delivery?: { minQty: number; amount: number }[];
  }
> = {
  // The showcase product: both ladders, so the storefront has something to render.
  // ৳42,500 list; delivery ৳150 inside Dhaka / ৳350 outside.
  ips1000: {
    quantity: [
      { minQty: 3, amount: 2125 },
      { minQty: 5, amount: 4250 },
    ],
    delivery: [
      { minQty: 2, amount: 75 },
      { minQty: 5, amount: 350 }, // ≥ both zone fees: free either way
    ],
  },
  vprot: {
    quantity: [
      { minQty: 5, amount: 132 },
      { minQty: 10, amount: 198 },
      { minQty: 25, amount: 297 },
    ],
    delivery: [{ minQty: 10, amount: 150 }],
  },
  flood100: {
    quantity: [{ minQty: 4, amount: 168 }],
    delivery: [{ minQty: 4, amount: 200 }],
  },
  // Delivery-only ladder — proves the two are independent.
  mccb400: {
    delivery: [
      { minQty: 2, amount: 60 },
      { minQty: 5, amount: 400 },
    ],
  },
};

/* ===== Customers ===== */

// `email` mirrors what registration now collects — the reset OTP target.
const customers = [
  { id: "c1", name: "Karim Uddin", phone: "01712345678", email: "karim.uddin@example.com", joinedAt: new Date("2026-06-01") },
  { id: "c2", name: "Salma Akter", phone: "01898112233", email: "salma.akter@example.com", joinedAt: new Date("2026-07-01") },
  { id: "c3", name: "Hasan Mia", phone: "01611778899", email: "hasan.mia@example.com", joinedAt: new Date("2026-05-01") },
  { id: "c4", name: "Rahim & Co. Textiles", phone: "01555334455", email: "accounts@rahimtextiles.example", joinedAt: new Date("2026-01-01") },
  { id: "c5", name: "Farida Begum", phone: "01722556677", email: "farida.begum@example.com", joinedAt: new Date("2026-07-01") },
];

/* ===== Orders (items reconstructed from the demo totals) ===== */

const day = (offset: number, hour = 12) => {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
};

// prettier-ignore
const orders = [
  { id: "ZT-10236", number: 10236, customerId: "c4", name: "Jamal Enterprise", phone: "01811990011", address: "Shop 14, Islampur Road, Old Dhaka", productId: "mccb400", qty: 1, status: "Delivered", createdAt: day(-9) },
  { id: "ZT-10237", number: 10237, customerId: "c5", name: "Farida Begum", phone: "01722556677", address: "House 22, Nasirabad H/S, Chattogram", productId: "flood100", qty: 1, status: "Delivered", createdAt: day(-7) },
  { id: "ZT-10238", number: 10238, customerId: "c4", name: "Rahim & Co. Textiles", phone: "01555334455", address: "Plot 19, BSCIC Industrial Area, Gazipur", productId: "solar10k", qty: 1, status: "Confirmed", createdAt: day(-5) },
  { id: "ZT-10239", number: 10239, customerId: "c3", name: "Hasan Mia", phone: "01611778899", address: "Holding 45, Kandirpar, Cumilla Sadar", productId: "solar500", qty: 1, status: "On the way", createdAt: day(-3) },
  { id: "ZT-10240", number: 10240, customerId: "c2", name: "Salma Akter", phone: "01898112233", address: "Flat 4B, Green Tower, Sector 11, Uttara, Dhaka", productId: "vprot", qty: 1, status: "Confirmed", createdAt: day(-1) },
  { id: "ZT-10241", number: 10241, customerId: "c1", name: "Karim Uddin", phone: "01712345678", address: "House 12, Road 7, Dhanmondi, Dhaka", productId: "ips1000", qty: 1, status: "Processing", createdAt: day(0, 9) },
];

/* ===== Leads / suppliers / POs / movements ===== */

// `service` is the Service *slug*, resolved to a serviceId at write time.
const leads = [
  { id: "l1", service: "industrial-commercial-solar", customer: "Rahim & Co. Textiles", address: "Gazipur", status: "Quoted" },
  { id: "l2", service: "33-11-kv-substation", customer: "Delta Spinning Mills", address: "Narayanganj", status: "Survey booked" },
  { id: "l3", service: "fire-protection-detection", customer: "City Tower Ltd.", address: "Dhaka", status: "New" },
  { id: "l4", service: "on-grid-off-grid-solar", customer: "Kamal Ahmed", address: "Chattogram", status: "Contacted" },
  { id: "l5", service: "building-management-system", customer: "Meridian Apartments", address: "Dhaka", status: "New" },
];

const suppliers = [
  { id: "sup1", name: "Rahman Electricals Ltd.", contact: "Mahfuz Rahman", phone: "01713-224466", items: "Protection & switchgear" },
  { id: "sup2", name: "SunPeak Solar BD", contact: "Tania Islam", phone: "01818-556677", items: "Solar panels & inverters" },
  { id: "sup3", name: "Dhaka Switchgear Co.", contact: "S. M. Kabir", phone: "01912-889900", items: "Breakers, ATS, panels" },
];

const purchaseOrders = [
  { id: "PO-2208", number: 2208, supplierId: "sup3", productId: "ats63", qty: 12, value: 126000, eta: new Date("2026-07-17"), status: "In transit" },
  { id: "PO-2210", number: 2210, supplierId: "sup2", productId: "solar500", qty: 6, value: 270000, eta: new Date("2026-07-22"), status: "Confirmed" },
  { id: "PO-2211", number: 2211, supplierId: "sup1", productId: "vprot", qty: 100, value: 110000, eta: new Date("2026-07-19"), status: "In transit" },
];

const movements = [
  { productId: "vprot", sku: "ZT-VPR-40", change: -12, reason: "Order ZT-10241 packed", by: "system", date: day(-1, 11) },
  { productId: "ips1000", sku: "ZT-IPS-1000", change: 10, reason: "PO-2207 received", by: "nusrat", date: day(-1, 9) },
  { productId: "flood100", sku: "ZT-FLD-100", change: -4, reason: "Order ZT-10237 shipped", by: "system", date: day(-2, 17) },
  { productId: "ats63", sku: "ZT-ATS-63", change: -6, reason: "Order ZT-10229 shipped", by: "system", date: day(-2, 10) },
  { productId: "stab30", sku: "ZT-STB-30K", change: -1, reason: "Warranty replacement", by: "arif", date: day(-3, 15) },
];

/* ===== Payment methods ===== */

// prettier-ignore
const paymentMethods = [
  { id: "bkash", name: "bKash", kind: "Mobile wallet", provider: "bKash Merchant API", providers: ["bKash Merchant API", "bKash PGW (Aggregator)"], enabled: true, environment: "Live", apiKey: "app_id: ZUP-9f3a12", apiSecret: "bk_live_7f31a92c44e8", webhookUrl: "https://api.zuptech.com/pay/bkash", isGateway: true, sort: 0 },
  { id: "nagad", name: "Nagad", kind: "Mobile wallet", provider: "Nagad PGW", providers: ["Nagad PGW"], enabled: true, environment: "Live", apiKey: "MID: ZUP0192837", apiSecret: "ng_live_c210d84feaa1", webhookUrl: "https://api.zuptech.com/pay/nagad", isGateway: true, sort: 1 },
  { id: "card", name: "Cards (Visa / Mastercard)", kind: "Card gateway", provider: "SSLCommerz", providers: ["SSLCommerz", "AamarPay", "Stripe"], enabled: true, environment: "Test", apiKey: "store_id: zuptechlive", apiSecret: "ssl_test_91b2ac0377", webhookUrl: "https://api.zuptech.com/pay/card", isGateway: true, sort: 2 },
  { id: "cod", name: "Cash on Delivery", kind: "Offline", provider: "Manual", providers: ["Manual"], enabled: true, environment: "Live", apiKey: "", apiSecret: "", webhookUrl: "", isGateway: false, sort: 3 },
  { id: "rocket", name: "Rocket", kind: "Mobile wallet", provider: "DBBL Rocket", providers: ["DBBL Rocket"], enabled: false, environment: "Test", apiKey: "", apiSecret: "", webhookUrl: "", isGateway: true, sort: 4 },
];

/* ===== Hero slides / site config ===== */

const slides = [
  { id: "sl1", image: "/images/banner-power-solutions.png", cta: "Shop Products", href: "/shop", active: true, fit: "cover", bg: "linear-gradient(115deg,#0B4FE0 0%,#083A9E 100%)", sort: 0 },
  { id: "sl2", image: "/images/banner-engineering-services.png", cta: "Explore Solutions", href: "/solutions", active: true, fit: "contain", bg: "linear-gradient(115deg,#DDE7F3 0%,#F5F8FC 100%)", sort: 1 },
];

// Mirrors frontend lib/solutions.ts — the /solutions page's engineering
// service cards. Upserted by slug; ids are cuids, so leads resolve their
// serviceId by slug rather than hard-coding one.
const services = [
  {
    slug: "lighting-automation-system",
    name: "Lighting Automation System",
    dsc:
      "Scene-based and scheduled lighting control for offices, factories and homes — occupancy sensors, dimming and daylight harvesting that cut lighting energy use significantly.",
    features: ["Occupancy sensors", "Scheduling & scenes", "Daylight harvesting", "DALI / KNX"],
    sort: 0,
  },
  {
    slug: "33-11-kv-substation",
    name: "33/11/0.45 kV Sub-Station",
    dsc:
      "Design, supply, installation, testing and commissioning of 33/11/0.45 kV substations — transformers, switchgear, protection and utility approvals handled end to end.",
    features: ["Transformers & switchgear", "Protection & metering", "Approvals & testing", "Annual maintenance"],
    sort: 1,
  },
  {
    slug: "building-management-system",
    name: "Building Management System",
    dsc:
      "Centralized monitoring and control of HVAC, power, lifts and utilities — one dashboard for your whole building.",
    features: ["HVAC control", "Energy dashboards", "Alarms & access", "SCADA integration"],
    sort: 2,
  },
  {
    slug: "fire-protection-detection",
    name: "Fire Protection & Detection Works",
    dsc:
      "Code-compliant fire detection and suppression — addressable detection, hydrant and sprinkler systems, designed, installed and certified.",
    features: ["Addressable detection", "Hydrant & sprinkler", "Fire pumps", "Compliance certification"],
    sort: 3,
  },
  {
    slug: "electrical-servicing-installation",
    name: "Electrical Servicing & Installation Works",
    dsc:
      "Complete electrical works for factories and commercial buildings — HT/LT lines, panels, cabling, earthing and annual servicing contracts.",
    features: ["HT/LT installation", "Panels & cabling", "Earthing & testing", "Service contracts"],
    sort: 4,
  },
  {
    slug: "on-grid-off-grid-solar",
    name: "On Grid / Off Grid Solar System",
    dsc:
      "Rooftop solar for homes and businesses — on-grid with net metering, off-grid with storage, or hybrid — designed and installed by certified engineers.",
    features: ["Net metering", "Hybrid + storage", "Design & EPC", "Monitoring app"],
    sort: 5,
  },
  {
    slug: "smart-energy-management-system",
    name: "Smart Energy Management System",
    dsc: "Metering, monitoring and analytics that find waste, manage peak load and cut your electricity bill measurably.",
    features: ["Smart metering", "Load analytics", "Peak management", "Reporting"],
    sort: 6,
  },
  {
    slug: "industrial-commercial-solar",
    name: "Industrial & Commercial Solar System",
    dsc:
      "Large-scale rooftop and ground-mount solar for factories and commercial sites — full EPC with structural study, financing options and O&M.",
    features: ["MW-scale EPC", "Structural study", "Financing options", "O&M"],
    sort: 7,
  },
];

/** A fresh install reads better when the photo alternates sides down the
 *  column, so the seed derives the side from the card's position rather than
 *  repeating it on every entry. Set on create only — once a card exists, its
 *  side is the admin's to choose. */
const imageSideFor = (sort: number) => (sort % 2 === 0 ? "left" : "right");

/**
 * The home page's own cards. Seeded as copies of the first four services so a
 * fresh install's front page reads the same as before the split — but they are
 * their own rows from that moment on. Editing one changes the home page and
 * nothing else, which is the entire reason the model exists.
 */
const showcaseCards = [
  {
    slug: "showcase-lighting-automation",
    name: "Lighting Automation System",
    dsc:
      "Scene-based and scheduled lighting control for offices, factories and homes — occupancy sensors, dimming and daylight harvesting that cut lighting energy use significantly.",
    features: ["Occupancy sensors", "Scheduling & scenes", "Daylight harvesting", "DALI / KNX"],
    sort: 0,
  },
  {
    slug: "showcase-substation",
    name: "33/11/0.45 kV Sub-Station",
    dsc:
      "Design, supply, installation, testing and commissioning of 33/11/0.45 kV substations — transformers, switchgear, protection and utility approvals handled end to end.",
    features: ["Transformers & switchgear", "Protection & metering", "Approvals & testing", "Annual maintenance"],
    sort: 1,
  },
  {
    slug: "showcase-building-management",
    name: "Building Management System",
    dsc: "Centralized monitoring and control of HVAC, power, lifts and utilities — one dashboard for your whole building.",
    features: ["HVAC control", "Energy dashboards", "Alarms & access", "SCADA integration"],
    sort: 2,
  },
  {
    slug: "showcase-industrial-solar",
    name: "Industrial & Commercial Solar",
    dsc:
      "Large-scale rooftop and ground-mount solar for factories and commercial sites — full EPC with structural study, financing options and O&M.",
    features: ["MW-scale EPC", "Structural study", "Financing options", "O&M"],
    sort: 3,
  },
];

// The industrial/EPC catalogue — display-only, not bookable via a lead.
const industrialServices = [
  {
    slug: "hv-substation-epc",
    name: "HV Sub-Station EPC",
    dsc: "Turnkey 33/11 kV substation delivery for factories and industrial parks — design, supply, erection, testing and utility approvals under one contract.",
    features: ["Turnkey EPC", "Utility liaison", "Protection studies", "O&M contracts"],
    sort: 0,
  },
  {
    slug: "industrial-power-distribution",
    name: "Industrial Power Distribution",
    dsc: "HT/LT distribution networks for plants — busways, distribution boards, cable routing and earthing designed to load and expansion plans.",
    features: ["Busway systems", "LT distribution boards", "Cable & tray routing", "Earthing & lightning"],
    sort: 1,
  },
  {
    slug: "captive-power-generation",
    name: "Captive Power Generation",
    dsc: "Generator and cogeneration installations with synchronising panels, fuel systems and automatic load management for continuous industrial operation.",
    features: ["Generator sizing", "Synchronising panels", "Fuel & exhaust systems", "Load management"],
    sort: 2,
  },
  {
    slug: "industrial-automation-scada",
    name: "Industrial Automation & SCADA",
    dsc: "PLC and SCADA systems for process and utility monitoring — panel build, programming, commissioning and operator training.",
    features: ["PLC panel build", "SCADA development", "Instrumentation", "Operator training"],
    sort: 3,
  },
];

const siteConfig = {
  featuredIds: ["ips1000", "solar500", "trafo200", "vprot", "stab30", "solar10k", "flood100", "mccb400"],
  // The home page's second row, above the booking forms. Deliberately a
  // different set from `featuredIds` above — two rows showing the same eight
  // products is the thing a separate list exists to avoid.
  homeRowIds: ["ats63", "panelLT", "flood100", "mccb400"],
  footerDescription: "Power solutions & services company. Makes life simple.",
  phone: "+8801700000000",
  phoneDisplay: "+880 17 0000 0000",
  hotline: "09612-345678",
  email: "hello@zuptech.com.bd",
  whatsapp: "8801700000000",
  street: "House 00, Road 00, Banani",
  city: "Dhaka",
  postalCode: "1213",
  hours: "9am–8pm",
  // The contact page's office card. Placeholders, same as the phone numbers
  // above — the client sets the real ones from the admin.
  officeName: "ZUP TECH Ltd.",
  warehouseName: "Warehouse & service centre",
  warehouseAddress: "Plot 00, Tejgaon Industrial Area, Dhaka 1208",
  hoursWeekday: "Sat – Thu · 9am – 8pm",
  hoursWeekend: "Friday · Closed",
  hoursEmergency: "Emergency service · 24/7",
  gtmId: "",
  gtmEnabled: false,
};

/* ===== Run ===== */

async function main() {
  console.log("Seeding…");

  for (const role of roles) {
    await prisma.role.upsert({ where: { id: role.id }, create: role, update: role });
  }

  // Staff sign in through Better Auth — create the auth user + profile row.
  for (const member of staff) {
    const existing = await prisma.staff.findUnique({ where: { username: member.username } });
    if (existing) {
      // The auth user already exists, so the signup below is skipped — but a
      // DB seeded before `email` was added still has none, and without it the
      // demo staff can't test the reset flow. Backfill it, leave the rest.
      if (!existing.email) {
        await prisma.staff.update({ where: { id: existing.id }, data: { email: member.email } });
      }
      continue;
    }

    const password = staffPassword();
    const signup = await auth.api.signUpEmail({
      body: {
        email: staffEmail(member.username), // synthetic sign-in id, not member.email
        password,
        name: member.name,
        username: member.username,
      },
    });
    try {
      await prisma.staff.create({ data: { ...member, userId: signup.user.id } });
    } catch (err) {
      await prisma.user.delete({ where: { id: signup.user.id } }).catch(() => {});
      throw err;
    }
    console.log(`  staff: ${member.username} · password: ${password}`);
  }

  // Taxonomy first — products can't be written without a category to point at.
  const sectionIds = new Map<string, string>();
  for (const section of sections) {
    const row = await prisma.section.upsert({
      where: { name: section.name },
      create: section,
      update: { sort: section.sort },
    });
    sectionIds.set(row.name, row.id);
  }

  const categoryIds = new Map<string, string>();
  for (const { section, ...category } of categories) {
    const data = { ...category, sectionId: sectionIds.get(section)! };
    const row = await prisma.category.upsert({
      where: { name: category.name },
      create: data,
      // svgLogo is left alone — an uploaded logo must survive a re-seed.
      update: { sectionId: data.sectionId, sort: data.sort },
    });
    categoryIds.set(row.name, row.id);
  }

  for (const { category, ...product } of products) {
    const data = { ...product, categoryId: categoryIds.get(category)! };
    await prisma.product.upsert({ where: { id: data.id }, create: data, update: data });
  }

  // Offer tiers are replace-all (same semantics as PATCH /admin/api/products/:id),
  // so re-seeding converges instead of accumulating duplicates.
  for (const [productId, ladder] of Object.entries(offers)) {
    await prisma.quantityOffer.deleteMany({ where: { productId } });
    await prisma.freeDeliveryOffer.deleteMany({ where: { productId } });
    if (ladder.quantity?.length) {
      await prisma.quantityOffer.createMany({
        data: ladder.quantity.map((tier) => ({ ...tier, productId })),
      });
    }
    if (ladder.delivery?.length) {
      await prisma.freeDeliveryOffer.createMany({
        data: ladder.delivery.map((tier) => ({ ...tier, productId })),
      });
    }
  }

  for (const customer of customers) {
    await prisma.customer.upsert({ where: { id: customer.id }, create: customer, update: customer });
  }

  const productPrice = new Map(products.map((p) => [p.id, p.price]));
  for (const o of orders) {
    const { productId, qty, ...row } = o;
    const price = productPrice.get(productId)!;
    await prisma.order.upsert({
      where: { id: o.id },
      update: {},
      create: {
        ...row,
        insideDhaka: true, // demo orders predate the zone flag — keep them intact
        subtotal: price * qty,
        deliveryFee: 0, // demo totals predate the fee rule — keep them intact
        total: price * qty,
        pay: "Cash on Delivery",
        items: { create: [{ productId, qty, unitPrice: price }] },
      },
    });
  }

  // Sequential ids continue after the demo ones.
  await prisma.counter.upsert({
    where: { id: "order" },
    create: { id: "order", value: 10241 },
    update: {},
  });
  await prisma.counter.upsert({
    where: { id: "po" },
    create: { id: "po", value: 2211 },
    update: {},
  });

  // Services before leads — a lead needs an existing service to reference.
  const serviceIds = new Map<string, string>();
  for (const service of services) {
    const row = await prisma.service.upsert({
      where: { slug: service.slug },
      create: { ...service, imageSide: imageSideFor(service.sort) },
      // image is left alone so an uploaded picture survives a re-seed, and
      // imageSide for the same reason — it is an editorial choice once made.
      update: { name: service.name, dsc: service.dsc, features: service.features, sort: service.sort },
    });
    serviceIds.set(row.slug, row.id);
  }
  for (const service of industrialServices) {
    await prisma.industrialService.upsert({
      where: { slug: service.slug },
      create: { ...service, imageSide: imageSideFor(service.sort) },
      update: { name: service.name, dsc: service.dsc, features: service.features, sort: service.sort },
    });
  }

  for (const card of showcaseCards) {
    await prisma.showcaseCard.upsert({
      where: { slug: card.slug },
      create: { ...card, imageSide: imageSideFor(card.sort) },
      update: { name: card.name, dsc: card.dsc, features: card.features, sort: card.sort },
    });
  }

  for (const { service, ...lead } of leads) {
    const data = { ...lead, serviceId: serviceIds.get(service)! };
    await prisma.serviceLead.upsert({ where: { id: data.id }, create: data, update: data });
  }
  for (const supplier of suppliers) {
    await prisma.supplier.upsert({ where: { id: supplier.id }, create: supplier, update: supplier });
  }
  for (const po of purchaseOrders) {
    await prisma.purchaseOrder.upsert({ where: { id: po.id }, create: po, update: po });
  }

  if ((await prisma.stockMovement.count()) === 0) {
    await prisma.stockMovement.createMany({ data: movements });
  }

  for (const method of paymentMethods) {
    await prisma.paymentMethod.upsert({ where: { id: method.id }, create: method, update: method });
  }
  for (const slide of slides) {
    await prisma.heroSlide.upsert({ where: { id: slide.id }, create: slide, update: slide });
  }

  await prisma.siteConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...siteConfig },
    update: siteConfig,
  });

  console.log("Seed complete ✔");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
