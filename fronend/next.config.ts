import path from "node:path";
import type { NextConfig } from "next";

const CLOUDINARY_ORIGIN = "https://res.cloudinary.com";
/** Cookie-free YouTube host — see lib/video.ts. */
const YOUTUBE_EMBED_ORIGIN = "https://www.youtube-nocookie.com";

/*
 * Google Tag Manager, GA4 and Tag Assistant.
 *
 * Split by what each directive actually needs, because "add googletagmanager"
 * is only a third of the story and the missing two thirds fail silently — the
 * container loads, the tags report themselves as present, and the hits never
 * arrive. Tag Assistant flagged exactly that on the live site.
 *
 * SCRIPT: the container and the gtag loader both come from googletagmanager.
 * tagassistant is the debug client, loaded only while previewing a container.
 *
 * COLLECT: GA4 does NOT post to www.google-analytics.com in most regions — it
 * posts to a REGIONAL endpoint (region1.google-analytics.com and friends), so
 * naming the bare host blocks the very requests that carry the data. The
 * analytics.google.com wildcard covers the newer collection paths, and the
 * googletagmanager wildcard covers server-side containers and custom domains.
 *
 * ADS: a GTM container almost always ends up carrying a Google Ads
 * conversion or remarketing tag, which pixels google.com and doubleclick.
 * Harmless if unused; without them, conversions silently never record. Drop
 * these two lines if this business never runs Google Ads.
 */
const GOOGLE_TAG_SCRIPT_ORIGINS = [
  "https://www.googletagmanager.com",
  "https://tagassistant.google.com",
];
const GOOGLE_COLLECT_ORIGINS = [
  "https://www.google-analytics.com",
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
  "https://*.googletagmanager.com",
];
const GOOGLE_ADS_PIXEL_ORIGINS = [
  "https://www.google.com",
  "https://stats.g.doubleclick.net",
  "https://googleads.g.doubleclick.net",
];
/*
 * Marketing and session-replay vendors, added through GTM.
 *
 * A container is only as useful as the network requests the page allows, and
 * CSP failures here are silent in exactly the way that wastes ad budget: the
 * tag fires, GTM's preview shows it green, and the request never leaves the
 * browser. That is the failure Tag Assistant caught for Google, and every
 * vendor below fails the same way for the same reason.
 *
 * Each is listed as the origins that vendor actually uses — script host,
 * collection host, and for replay tools a websocket. Trim this list to what is
 * genuinely in the container: every origin here is somewhere a page is
 * permitted to send data, which is the thing a CSP exists to constrain.
 *
 *   Meta Pixel        connect.facebook.net, facebook.com
 *   TikTok Pixel      analytics.tiktok.com
 *   Microsoft Clarity clarity.ms  (heatmaps + session replay, free)
 *   Hotjar            hotjar.com / hotjar.io  (heatmaps, needs the wss)
 */
const MARKETING_SCRIPT_ORIGINS = [
  "https://connect.facebook.net",
  "https://analytics.tiktok.com",
  "https://www.clarity.ms",
  "https://*.clarity.ms",
  "https://static.hotjar.com",
  "https://script.hotjar.com",
];
const MARKETING_CONNECT_ORIGINS = [
  "https://www.facebook.com",
  "https://connect.facebook.net",
  "https://analytics.tiktok.com",
  "https://*.clarity.ms",
  "https://*.hotjar.com",
  "https://*.hotjar.io",
  // Hotjar streams a recording over a socket; without this replay silently
  // records nothing while the script itself loads perfectly happily.
  "wss://*.hotjar.com",
];
const MARKETING_IMG_ORIGINS = [
  "https://www.facebook.com",
  "https://analytics.tiktok.com",
  "https://*.clarity.ms",
  "https://*.hotjar.com",
];
/** Where a form may POST. Only Meta needs this, and only for /tr. */
const MARKETING_FORM_ORIGINS = ["https://www.facebook.com"];

/** Meta and Hotjar both open iframes for consent/preview flows. */
const MARKETING_FRAME_ORIGINS = [
  "https://www.facebook.com",
  "https://*.hotjar.com",
];

const list = (origins: string[]) => origins.join(" ");

const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Disallow embedding in iframes (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Only send origin on cross-origin navigations
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The site uses no camera/mic/geolocation
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

/**
 * Content-Security-Policy.
 *
 * ENFORCING. It ran report-only first, and was switched over after loading the
 * storefront and the admin in a browser and confirming neither reported a
 * violation — which is the only way to know, since a CSP breaks pages in ways
 * that show up nowhere else.
 *
 * Two known-awkward tenants keep 'unsafe-inline' in script-src: Next's inline
 * bootstrap/hydration scripts and the GTM loader snippet. Both are fixable with
 * nonces; until that work happens this policy is weaker against injected inline
 * script than it looks, and is worth more for the other directives —
 * frame-ancestors, object-src, base-uri, form-action and the img/media/connect
 * allow-lists.
 *
 * The category-logo XSS sink this was added for is now closed at the source
 * (sanitizeSvgLogo parses and allowlists rather than pattern-matching), so
 * this is defence in depth rather than the only line.
 */
function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    // 'unsafe-inline'/'unsafe-eval': Next's bootstrap + the GTM loader.
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${list(GOOGLE_TAG_SCRIPT_ORIGINS)} ${list(MARKETING_SCRIPT_ORIGINS)}`,
    "style-src 'self' 'unsafe-inline'",
    // i.ytimg.com: the poster frame for a YouTube product video, shown before
    // the viewer clicks play (components/product-video.tsx).
    // GA4 and Ads still fall back to pixel requests for some hits, so the
    // collection hosts belong here as well as in connect-src.
    `img-src 'self' data: blob: ${CLOUDINARY_ORIGIN} https://i.ytimg.com ${list(GOOGLE_TAG_SCRIPT_ORIGINS)} ${list(GOOGLE_COLLECT_ORIGINS)} ${list(GOOGLE_ADS_PIXEL_ORIGINS)} ${list(MARKETING_IMG_ORIGINS)}`,
    `media-src 'self' ${CLOUDINARY_ORIGIN}`,
    // Only reached once someone actually plays a YouTube product video — the
    // page embeds no iframe until then.
    // googletagmanager/tagassistant: the container preview iframe. Without
    // them "Preview" in GTM connects and then shows nothing.
    `frame-src ${YOUTUBE_EMBED_ORIGIN} ${list(GOOGLE_TAG_SCRIPT_ORIGINS)} ${list(MARKETING_FRAME_ORIGINS)}`,
    "font-src 'self' data:",
    // The browser talks to the API same-origin through the rewrites below.
    `connect-src 'self' ${list(GOOGLE_COLLECT_ORIGINS)} ${list(GOOGLE_TAG_SCRIPT_ORIGINS)} ${list(GOOGLE_ADS_PIXEL_ORIGINS)} ${list(MARKETING_CONNECT_ORIGINS)}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    /*
     * Meta's Pixel does not only use image beacons. For payloads too big for a
     * GET — a Purchase carrying `contents`, which is exactly the event that
     * matters most — it falls back to POSTing a hidden form to
     * facebook.com/tr. With `form-action 'self'` the browser blocks that
     * silently: measured on the live site, four /tr attempts produced two
     * form-action violations, so the small events arrived and the valuable
     * ones did not. Everything else still may only submit to this origin.
     */
    `form-action 'self' ${list(MARKETING_FORM_ORIGINS)}`,
    "object-src 'none'",
  ].join("; ");
}

// The real backend (see BACKEND.md / cal-bk.md / openapi.json). The frontend
// runs on :3001 and proxies all API traffic there, so the browser stays
// same-origin and the better-auth session cookie works unchanged.
export const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

// Admin uploads (product photos, hero banners, service images) are stored on
// Cloudinary and served from res.cloudinary.com as absolute URLs, so
// next/image needs the account's delivery path allow-listed to optimize
// them. Cloud name isn't a secret — it's just an account identifier baked
// into every delivery URL — so it's safe as a public env var.
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

const nextConfig: NextConfig = {
  // Docker image size: standalone emits .next/standalone with only the files
  // the server actually traces to, so the runtime stage needs no node_modules
  // copy (~1 GB -> ~200 MB).
  output: "standalone",
  // This is a Bun workspace, so hoisted deps live in the REPO root
  // node_modules, above this package. Without widening the trace root, Next
  // roots it at fronend/ and silently omits them, and the container dies at
  // startup on a missing module. `bun run build` runs with cwd = fronend.
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  images: {
    // Scoped to this account's own delivery path — Cloudinary's transform
    // segments are part of the path, not a query string, so `search: ""`
    // (blocking query strings) stays correct.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: `/${CLOUDINARY_CLOUD_NAME}/**`,
        search: "",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...securityHeaders,
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy(),
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // /solutions was renamed to /services (2026-07-26) — permanent so
      // search engines and any existing backlinks transfer cleanly.
      { source: "/solutions", destination: "/services", permanent: true },
      // /shop was renamed to /products (2026-08-13), so the catalogue and the
      // product pages under it finally share a prefix. Permanent for the same
      // reason as above; the query string carries over untouched, which is what
      // keeps /shop?q=… working for the header search and any indexed result.
      { source: "/shop", destination: "/products", permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/admin/api/:path*", destination: `${BACKEND_URL}/admin/api/:path*` },
      { source: "/pay/:provider", destination: `${BACKEND_URL}/pay/:provider` },
      // Live OpenAPI docs, reachable from the frontend origin
      { source: "/openapi", destination: `${BACKEND_URL}/openapi` },
      { source: "/openapi/:path*", destination: `${BACKEND_URL}/openapi/:path*` },
    ];
  },
};

export default nextConfig;
