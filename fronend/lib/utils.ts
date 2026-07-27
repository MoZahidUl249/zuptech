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
