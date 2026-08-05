"use client";

import { ApiRequestError, logApiFailure, type ValidationDetail } from "@/lib/api-error";
import { failureStatus, type EdenFailure } from "@/lib/eden";

/*
 * Shared plumbing for every admin client (admin-api, admin-invoices,
 * admin-warranty, admin-landing-pages).
 *
 * Requests themselves now go through the Eden client in lib/eden.ts, which
 * types routes, params and responses against the backend's own definitions.
 * What lives here is the half Eden deliberately leaves to the caller: turning
 * its `{data, error}` result into the thrown AdminApiError the admin UI has
 * always expected.
 *
 * Calls stay same-origin — next.config.ts proxies /admin/api to the backend so
 * the Better Auth staff session cookie stays first-party. There is no token to
 * attach; if you find yourself adding an Authorization header, something has
 * gone wrong.
 */

/** Carries the HTTP status so callers can tell 403 (no permission) from 409
 *  (server refused, e.g. deleting a category that still has products) from a
 *  genuine failure — plus, now, the method/path and the server's validation
 *  detail. See lib/api-error.ts. */
export class AdminApiError extends ApiRequestError {
  constructor(init: { status: number; method: string; path: string; body: unknown }) {
    super(init);
    this.name = "AdminApiError";
  }
}

export type { ValidationDetail };

/**
 * Unwraps an Eden call into the value, or throws AdminApiError.
 *
 * `what` is the human-readable "METHOD /path" — Eden knows the route at the
 * type level but doesn't hand it back at runtime, and an error that can't say
 * which request failed is most of the way to useless.
 */
export async function unwrap<T>(
  call: Promise<{ data: T | null; error: EdenFailure | null }>,
  what: string,
): Promise<T> {
  const { data, error } = await call;
  if (error) {
    const [method = "GET", ...rest] = what.split(" ");
    const failure = new AdminApiError({
      status: failureStatus(error),
      method,
      path: rest.join(" "),
      body: error.value,
    });
    logApiFailure(failure);
    throw failure;
  }
  return data as T;
}
