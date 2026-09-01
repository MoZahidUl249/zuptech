import { ApiError } from "../http";

/**
 * Where to send a customer back to after the gateway is done with them.
 *
 * The three return URLs are handed to EPS, so they must be the *storefront's*
 * public origin — not this API's, and not whatever Host header a request
 * arrived with. Deriving them from the request would let anyone who can set a
 * Host header choose where paying customers land, which is a redirect straight
 * out of the checkout flow.
 *
 * `STOREFRONT_URL` is the explicit answer. Absent, the first entry of
 * `CORS_ORIGINS` is used, which is already the storefront origin in every
 * environment this runs in (see app.ts) — one variable, not two, for the
 * common case.
 */
export function storefrontUrl(): string {
  const explicit = process.env.STOREFRONT_URL?.trim();
  const fallback = (process.env.CORS_ORIGINS ?? "").split(",")[0]?.trim();
  const base = explicit || fallback;

  if (!base) {
    throw new ApiError(
      500,
      "Cannot build payment return URLs — set STOREFRONT_URL (or CORS_ORIGINS) on the backend",
    );
  }
  return base.replace(/\/+$/, "");
}
