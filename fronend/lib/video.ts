/**
 * A product's `video` field holds one of two things, and they render nothing
 * alike: a file we uploaded (served from Cloudinary, playable in a native
 * <video>) or a YouTube link someone pasted (playable only in an iframe).
 * Feeding a YouTube watch URL to <video src> gives a dead player and a
 * MEDIA_ELEMENT_ERROR, so every consumer has to branch on which one it is —
 * this is where that decision is made, once.
 */

export type ProductVideo =
  | { kind: "youtube"; id: string; embedUrl: string; thumbnailUrl: string }
  | { kind: "file"; url: string };

/** YouTube ids are exactly 11 chars of [A-Za-z0-9_-]. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/**
 * The id's position depends on the URL shape people paste: `?v=` on a watch
 * link, the first path segment on a youtu.be short link, and the segment after
 * the marker on /embed/, /shorts/, /live/ and /v/.
 */
function youtubeId(parsed: URL): string | null {
  const host = parsed.hostname.toLowerCase();

  if (host === "youtu.be" || host === "www.youtu.be") {
    return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
  }

  if (!YOUTUBE_HOSTS.has(host)) return null;

  const v = parsed.searchParams.get("v");
  if (v) return v;

  const segments = parsed.pathname.split("/").filter(Boolean);
  const marker = segments.findIndex((s) => ["embed", "shorts", "live", "v"].includes(s));
  return marker >= 0 ? (segments[marker + 1] ?? null) : null;
}

/**
 * Classifies a stored video URL. Returns null for empty/unparseable values so
 * callers can render nothing without a separate emptiness check.
 *
 * Anything that isn't a recognisable YouTube link falls through to `file` —
 * that's the Cloudinary case today, and it keeps working unchanged if the
 * files ever move to another host.
 */
export function parseProductVideo(url: string | null | undefined): ProductVideo | null {
  const raw = url?.trim();
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const id = youtubeId(parsed);
  // A YouTube host with an unusable id is not treated as YouTube — better to
  // fall through than to build an embed URL that 404s in an iframe.
  if (id && YOUTUBE_ID.test(id)) {
    return {
      kind: "youtube",
      id,
      // nocookie: no YouTube cookie is set unless the viewer actually plays it.
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      // hqdefault, not maxresdefault — the latter 404s on anything never
      // uploaded in HD, which would leave a broken thumbnail.
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  }

  return { kind: "file", url: raw };
}
