import { badRequest } from "../http";
import { steadfast } from "./steadfast";
import type { CourierAdapter } from "./types";

/**
 * Which code runs for a courier row.
 *
 * `self` and `manual` have no adapter and that is the point — booking them is
 * a database write and nothing else. Returning `null` rather than a
 * do-nothing adapter keeps that honest: the caller has to decide what a
 * courier with no integration means, instead of calling `book()` and quietly
 * getting a fabricated success back.
 */

const BY_PROVIDER: Record<string, CourierAdapter> = {
  steadfast,
};

/** The adapter for a courier row, or null when it is not an API courier. */
export function adapterFor(kind: string, provider: string): CourierAdapter | null {
  if (kind !== "api") return null;

  const adapter = BY_PROVIDER[provider.trim().toLowerCase()];
  if (!adapter) {
    throw badRequest(
      `No shipping integration for "${provider}" — set the courier to Manual, or use a supported provider (${Object.keys(BY_PROVIDER).join(", ")})`,
    );
  }
  return adapter;
}

export { steadfast };
export * from "./types";
