import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** URL-safe slug from a display name, e.g. for auto-generating a new admin
 *  record's slug from its title. Falls back to a timestamp-based slug for
 *  names that produce nothing usable (all punctuation, single character). */
export function slugify(name: string, fallbackPrefix = "item"): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length >= 2 ? s : `${fallbackPrefix}-${Date.now()}`;
}

/**
 * Read a number input as the whole number the API will accept.
 *
 * Every money and count field on the admin is an integer server-side (money is
 * integer BDT throughout), and `<input type="number">` hands back whatever was
 * typed — "1250.50", "12e3", "" or "abc". The fields used to do
 * `Math.max(0, Number(value) || 0)`, which passes 1250.5 through untouched: the
 * DTO then answered 422 with a schema dump, so a price typed with poysha made
 * the whole product unsavable. Some fields rounded and some didn't, and the
 * ones that didn't were the ones people type into.
 *
 * NaN (and any non-finite result) reads as `min`, so a half-typed value never
 * becomes a submitted one.
 */
export function whole(
  value: string,
  { min = 0, max = Number.MAX_SAFE_INTEGER }: { min?: number; max?: number } = {},
): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/**
 * Normalize a slug the operator is *typing*, for the editable slug fields.
 *
 * Not slugify(): that trims the trailing hyphen, so typing "solar panel" lost
 * the separator the moment the space was pressed and the next keystroke ran the
 * two words together. This keeps every character the API's `^[a-z0-9-]+$`
 * accepts and folds the rest to a hyphen, so a slug can never leave the form in
 * a shape the server rejects — a manually typed "Solar Panel" used to reach
 * POST /admin/api/products as-is and come back 422 with a schema dump.
 */
export function slugChars(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}
