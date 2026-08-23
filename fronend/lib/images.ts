/**
 * What we are allowed to do with an image URL, decided from the URL itself.
 *
 * Every picture on this site is a string in the database, and nothing that
 * renders one asks whether it is still good. That is fine until the data
 * rots — and on 2026-08-23 it had: a hero slide pointed at a Cloudinary asset
 * somebody had deleted, so the homepage banner was blank white space and both
 * frontend containers logged `upstream image response failed … 404` on every
 * render.
 *
 * The sharper version of the same problem is `next/image`'s host allow-list.
 * A URL outside `remotePatterns` does not degrade to a broken picture: the
 * default loader THROWS, which in a server component is an HTTP 500. One bad
 * hostname takes `/`, `/services` and `/industrial` down together, because all
 * three render the same carousel. Reproduced before this file existed.
 *
 * So callers ask here first.
 */

/**
 * The Cloudinary account admin uploads land on.
 *
 * `NEXT_PUBLIC_` because this is read while rendering on the client too, and
 * because a cloud name is an account identifier rather than a secret — it is
 * baked into every delivery URL the browser already fetches.
 *
 * Read through a function, not a module constant, so a test can set the
 * variable before the first call.
 */
function cloudName(): string {
  return process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
}

/** The transform `lib/storage.ts` bakes into every image URL it issues. */
const IMAGE_TRANSFORM = "c_limit,f_auto,q_auto,w_1600";

/**
 * True when `next/image` will accept this src.
 *
 * MUST stay in step with `images.remotePatterns` in next.config.ts — same
 * host, same account path, and `search: ""` there means a query string is
 * rejected, so one is rejected here too. If the two ever disagree the
 * optimistic answer is the dangerous one: it lets a URL reach the loader that
 * the loader will throw on.
 *
 * Local paths (`/images/…`) are always fine. Anything else — another
 * Cloudinary account after a migration, a hand-pasted URL, an asset host we
 * have not configured — is not, and the caller should render it unoptimised
 * rather than hand it to the loader.
 */
export function isOptimizableImageSrc(src: string | null | undefined): boolean {
  const raw = src?.trim();
  if (!raw) return false;

  // Relative to our own origin. `//host/path` is protocol-relative, not local.
  if (raw.startsWith("/") && !raw.startsWith("//")) return !raw.includes("?");

  const cloud = cloudName();
  if (!cloud) return false;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.hostname !== "res.cloudinary.com") return false;
  // `search: ""` in the config — a query string is not covered by the pattern.
  if (parsed.search) return false;
  return parsed.pathname.startsWith(`/${cloud}/`);
}

/**
 * The same picture, asked for at a smaller width.
 *
 * Cloudinary carries its transform in the path, so the width we uploaded with
 * is a literal segment we can swap. The catalogue was the reason: product
 * cards are 195 px wide and were downloading the 1600 px original — measured
 * against the live CDN, 64.5 KB per card where 14.3 KB would do, roughly
 * 1.3 MB on /products for a mobile-first audience.
 *
 * **Render-time only. Never write the result back to a row.** `parseCloudinaryRef`
 * in backend/src/lib/storage.ts recovers a `public_id` by stripping the exact
 * transform string it issued; a stored URL carrying `w_400` would no longer
 * match, and the asset could never be deleted from Cloudinary again.
 *
 * Anything that is not one of our own delivery URLs comes back untouched —
 * there is no width to swap, and guessing at someone else's URL scheme is how
 * you turn a working picture into a 404.
 */
export function cloudinaryWidth(src: string, width: number): string {
  if (!isOptimizableImageSrc(src)) return src;
  if (!src.includes(`/${IMAGE_TRANSFORM}/`)) return src;
  return src.replace(
    `/${IMAGE_TRANSFORM}/`,
    `/c_limit,f_auto,q_auto,w_${Math.round(width)}/`,
  );
}

/** Raster formats a browser will paint in an `<img>` but not play in a `<video>`. */
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "svg"];

/**
 * True when the URL's path ends in a picture extension.
 *
 * Used to stop a photo being rendered inside a `<video>`. The campaign
 * gallery's paste box tagged every link it was given as a clip, so pasting a
 * photo produced a black rectangle with `MediaError.code 4` behind it and no
 * way for the visitor to know what went wrong.
 *
 * Extension-only, deliberately. Fetching the URL to sniff its type would make
 * rendering async and would still be wrong for anything served without an
 * extension; the server classifies uploads properly from their magic bytes
 * (`classifyMediaUrl` in the backend's rules.ts is the write-side twin of
 * this). This is the cheap render-time check that catches the pasted-photo
 * case, which is the one that actually happens.
 */
export function looksLikeImageUrl(src: string | null | undefined): boolean {
  const raw = src?.trim();
  if (!raw) return false;

  let pathname: string;
  try {
    pathname = new URL(raw, "https://placeholder.invalid").pathname;
  } catch {
    return false;
  }

  const ext = pathname.split(".").pop()?.toLowerCase();
  return ext !== undefined && IMAGE_EXTENSIONS.includes(ext);
}
