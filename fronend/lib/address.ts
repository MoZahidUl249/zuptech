/*
 * Delivery addresses are one free-text string.
 *
 * The backend stores `Customer.address` and `Order.address` as plain text and
 * prices delivery from a single inside/outside-Dhaka boolean — there is no
 * structured location model behind it. An earlier attempt at a
 * Division→District→Upazila→Union picker (lib/bd-geo.ts, lib/locations.ts,
 * components/location-select.tsx) was built against an endpoint that was never
 * implemented, and has been removed.
 *
 * What survives is the one thing that carried real information: folding an
 * optional landmark into the address and pulling it back out, so editing an
 * address twice doesn't stack "(Landmark: …)" suffixes.
 */

/** Address + optional landmark → the single string the API stores. */
export function composeAddress(freeText: string, landmark: string): string {
  const base = freeText.trim();
  return landmark.trim() ? `${base} (Landmark: ${landmark.trim()})` : base;
}

// The Upazila/Union and Thana alternatives match addresses written by the
// abandoned location picker — still in the database, so still parsed.
const COMPOSED_SUFFIX_RE =
  /^(.*?)(?:,\s*[^,()]+ Upazila,\s*[^,()]+ Union|,\s*[^,()]+ Thana)?(?:\s*\(Landmark:\s*(.*?)\))?$/;

/**
 * Splits a stored address back into its editable parts. Falls back to treating
 * the whole string as free text when nothing matches — e.g. an address saved
 * before this composition existed.
 */
export function stripComposedAddress(fullAddress: string): { address: string; landmark: string } {
  const m = fullAddress.match(COMPOSED_SUFFIX_RE);
  return { address: (m?.[1] ?? fullAddress).trim(), landmark: (m?.[2] ?? "").trim() };
}
