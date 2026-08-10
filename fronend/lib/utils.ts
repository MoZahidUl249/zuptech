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

type Bounds = { min?: number; max?: number };

/**
 * Read a number input into state, while it is still being typed.
 *
 * Deliberately does NOT round. A controlled `<input type="number">` renders
 * back whatever this returns, so rounding here fights the keyboard: typing
 * "1250.50" rounds at the "1250." keystroke, the input re-renders as "1250",
 * the dot the operator typed is gone, and the remaining "5" and "0" land as
 * digits — ৳12,510 saved silently for a ৳1,250.50 that was typed. Wrong money
 * with no error is worse than the 422 that rounding here was meant to prevent.
 *
 * Rounding to the integer the API takes belongs at the boundary, on the way
 * out — see `whole()`.
 *
 * A half-typed or unparseable value ("", "-", "abc") reads as `min`, so state
 * never holds NaN.
 */
export function numberInput(value: string, { min = 0, max = Infinity }: Bounds = {}): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/**
 * The whole number the API will accept, for the boundary that sends it.
 *
 * Every money and count field is an integer server-side (money is integer BDT
 * throughout), and `t.Integer` answers 1250.5 with a 422 carrying a schema
 * dump — which is how a price typed with poysha made a product unsavable, with
 * nothing in the panel saying why. Apply this where the request body is built,
 * not where the keystroke arrives.
 */
export function whole(
  value: string | number,
  { min = 0, max = Number.MAX_SAFE_INTEGER }: Bounds = {},
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
