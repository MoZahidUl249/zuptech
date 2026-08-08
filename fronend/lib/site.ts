/**
 * ⚠️ LAUNCH BLOCKER — several values below are placeholders, and they are not
 * cosmetic: app/layout.tsx publishes them as Organization/LocalBusiness
 * JSON-LD on EVERY page, so search engines ingest them as facts about a real
 * company. `site.phoneDisplay` also appears verbatim in the contact page's
 * meta description.
 *
 * Replace with the client's real details before the site is public:
 *   phone / phoneDisplay / whatsapp — currently sequential zeros
 *   address.street                  — currently "House 00, Road 00"
 *   email                           — hello@ on a domain that may not be ours
 *   social.*                        — unverified handles
 *   stats                           — unverified claims ("40+ substations")
 *
 * `url` is safe: it reads NEXT_PUBLIC_SITE_URL, set per environment at build
 * time. The fallback only applies to local dev.
 *
 * The contact details shown in the page BODY come from the admin
 * (SiteConfig / useSiteContact) and can be corrected without a deploy — it is
 * only the structured data and metadata that are pinned here.
 */
export const site = {
  name: "ZUP TECH",
  legalName: "ZUP TECH",
  tagline: "Power solutions & services company. Makes life simple.",
  description:
    "ZUP TECH is a power solutions & services company in Bangladesh — engineered hardware and turnkey energy services, from a single voltage stabilizer to a 33 kV substation.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://zuptech.com.bd",
  phone: "+8801700000000",
  phoneDisplay: "+880 17 0000 0000",
  email: "hello@zuptech.com.bd",
  whatsapp: "https://wa.me/8801700000000",
  address: {
    street: "House 00, Road 00, Banani",
    city: "Dhaka",
    postalCode: "1213",
    country: "BD",
  },
  hours: "9am–8pm",
  social: {
    facebook: "https://www.facebook.com/zuptech",
    youtube: "https://www.youtube.com/@zuptech",
    linkedin: "https://www.linkedin.com/company/zuptech",
  },
  stats: [
    { value: "40+", label: "substations delivered" },
    { value: "12 MW", label: "solar installed" },
    { value: "250+", label: "clients served" },
  ],
} as const;

export function formatBDT(n: number): string {
  return "৳ " + n.toLocaleString("en-IN");
}

/**
 * Money in Bangla numerals — ৳২,৯৯০ rather than ৳ 2,990.
 *
 * Separate from `formatBDT` on purpose: the storefront and the admin run in
 * English and their numbers should stay legible to whoever is reading a
 * spreadsheet next to them. A campaign landing page is the one surface written
 * entirely in Bangla, and Western digits in the middle of Bangla copy read as
 * a mistake — the price is the most-read text on the page.
 */
/**
 * Western digits to Bangla ones. For the numbers that are not money — a
 * quantity, a list index — on a page written in Bangla.
 */
export function toBanglaDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);
}

export function formatBDTBangla(n: number): string {
  return "৳" + n.toLocaleString("bn-BD");
}

/**
 * Serialize JSON-LD for a <script> tag. Escapes `<` so no value can ever
 * close the tag and inject markup (defense-in-depth for structured data).
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
