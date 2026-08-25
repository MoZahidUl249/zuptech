/**
 * Who bought it, in the form Meta can match — and nobody else can read.
 *
 * Meta's Advanced Matching takes identifiers about the buyer (name, phone,
 * email, city) alongside the Purchase event and matches them against its own
 * users. Without it a conversion is a number; with it, it is attributable to
 * the ad click that produced it, and buyers can seed a lookalike audience.
 *
 * Both GTM containers were already wired for this — `customerFirstName`,
 * `customerBillingPhone`, `customerBillingEmail` and friends are declared as
 * dataLayer variables in each — and the site had never pushed one of them, so
 * every field resolved to undefined on every order. This is what fills them.
 *
 * ── Why these values are hashed here, and not left to the tag ─────────────
 *
 * `dataLayer` is shared. Every tag in the container can read it, and the CSP
 * in next.config.ts shows these containers are cleared for TikTok, Microsoft
 * Clarity and Hotjar. The last two record sessions. Pushing a raw phone number
 * into that array hands it to every one of them, which is a much bigger
 * decision than "Meta gets the order" and not one anybody made deliberately.
 *
 * So the plaintext never reaches the dataLayer. Values are normalised and
 * SHA-256'd in the browser, exactly as Meta specifies, and only the digests
 * are pushed. Match quality is identical — Meta hashes these anyway, and
 * compares digests — this only decides who else gets to see the original.
 *
 * The tag must therefore be configured to treat the fields as ALREADY HASHED.
 * A tag left on "hash this for me" would hash the digest and match nothing, so
 * container config and this file have to ship together.
 */

/** Meta's Advanced Matching keys, under the names both containers read. */
export interface CustomerMatch {
  customerFirstName?: string;
  customerLastName?: string;
  customerBillingPhone?: string;
  customerBillingEmail?: string;
  customerBillingCity?: string;
  customerBillingCountry?: string;
  /* Named keys above are the contract; the index signature is what lets this
     be handed to `trackPurchase`, which takes an opaque bag of strings so
     analytics.ts need not know what Advanced Matching is. */
  [key: string]: string | undefined;
}

/** What a caller knows about the buyer, in plaintext, before any of this. */
export interface CustomerFacts {
  /** Full name as typed — split on the last space for first/last. */
  name?: string | null;
  phone?: string | null;
  /** Real inbox. "" for guests and older accounts; those simply omit it. */
  email?: string | null;
  /** The delivery zone is the only location fact checkout collects. */
  insideDhaka?: boolean | null;
}

/**
 * Meta's normalisation rules, which are not optional: a digest only matches if
 * both sides normalised identically first. Trim, lowercase, strip internal
 * whitespace and punctuation for names.
 */
function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Phone numbers go to digits with a country code and no `+`.
 *
 * Local numbers are stored as `01XXXXXXXXX` (see `customerEmail` in the
 * backend's rules.ts — the leading zero is the local form). Meta wants the
 * international form, so the zero is replaced with Bangladesh's 880 rather
 * than dropped: `01711…` → `8801711…`. A number that already carries the
 * country code is left as it is.
 */
function normalizePhone(value: string): string {
  const digits = value.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return `880${digits.slice(1)}`;
  return digits;
}

/** Email: trim and lowercase. Meta does not want the dots-and-plus games. */
function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * SHA-256, hex, via Web Crypto.
 *
 * Async because `crypto.subtle` is, which is why the callers below await
 * before pushing. Returns null anywhere Web Crypto is unavailable — an
 * insecure context, an ancient browser, the server — and a null field is
 * omitted rather than pushed empty, because an empty string is a value Meta
 * would try to match and fail on.
 */
async function sha256Hex(value: string): Promise<string | null> {
  if (!value) return null;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  try {
    const bytes = new TextEncoder().encode(value);
    const digest = await subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Measurement must never be able to break a checkout — same contract as
    // `track()` in analytics.ts.
    return null;
  }
}

/**
 * Split a full name the way a form gives it to us.
 *
 * Last token is the surname, everything before it the given name(s). Wrong for
 * some naming conventions, and right for the overwhelming majority of what
 * this form receives; a single-token name becomes a first name with no last,
 * which is what Meta expects rather than a duplicated value.
 */
function splitName(full: string): { first: string; last: string } {
  const parts = normalizeText(full).split(" ").filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0]!, last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1]! };
}

/**
 * Build the hashed match block for one buyer.
 *
 * Every present fact is normalised, hashed and included; every absent one is
 * left out entirely. Callers hand this straight to `trackPurchase`.
 *
 * State and postcode are deliberately absent: checkout collects a free-text
 * address and a delivery zone, and neither yields a reliable postcode. Sending
 * a guessed one would lower match quality, not raise it. City is only claimed
 * when the zone actually says Dhaka — "outside Dhaka" names no city, so it
 * contributes nothing.
 */
export async function buildCustomerMatch(facts: CustomerFacts): Promise<CustomerMatch> {
  const out: CustomerMatch = {};

  if (facts.name?.trim()) {
    const { first, last } = splitName(facts.name);
    const [firstHash, lastHash] = await Promise.all([
      first ? sha256Hex(first) : null,
      last ? sha256Hex(last) : null,
    ]);
    if (firstHash) out.customerFirstName = firstHash;
    if (lastHash) out.customerLastName = lastHash;
  }

  if (facts.phone?.trim()) {
    const hash = await sha256Hex(normalizePhone(facts.phone));
    if (hash) out.customerBillingPhone = hash;
  }

  if (facts.email?.trim()) {
    const hash = await sha256Hex(normalizeEmail(facts.email));
    if (hash) out.customerBillingEmail = hash;
  }

  if (facts.insideDhaka === true) {
    const hash = await sha256Hex("dhaka");
    if (hash) out.customerBillingCity = hash;
  }

  // Every order this site takes ships within Bangladesh, so the country is a
  // fact rather than a guess — and it is one of the cheapest signals to match on.
  const country = await sha256Hex("bd");
  if (country) out.customerBillingCountry = country;

  return out;
}

/** Exported for the tests, which pin the normalisation against Meta's rules. */
export const __normalize = { normalizeText, normalizePhone, normalizeEmail, splitName };
