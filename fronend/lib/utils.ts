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
