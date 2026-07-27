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
 * Serialize JSON-LD for a <script> tag. Escapes `<` so no value can ever
 * close the tag and inject markup (defense-in-depth for structured data).
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
