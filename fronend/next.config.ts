import path from "node:path";
import type { NextConfig } from "next";

const CLOUDINARY_ORIGIN = "https://res.cloudinary.com";
/** Cookie-free YouTube host — see lib/video.ts. */
const YOUTUBE_EMBED_ORIGIN = "https://www.youtube-nocookie.com";

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
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline'",
    // i.ytimg.com: the poster frame for a YouTube product video, shown before
    // the viewer clicks play (components/product-video.tsx).
    `img-src 'self' data: blob: ${CLOUDINARY_ORIGIN} https://i.ytimg.com https://www.googletagmanager.com`,
    `media-src 'self' ${CLOUDINARY_ORIGIN}`,
    // Only reached once someone actually plays a YouTube product video — the
    // page embeds no iframe until then.
    `frame-src ${YOUTUBE_EMBED_ORIGIN}`,
    "font-src 'self' data:",
    // The browser talks to the API same-origin through the rewrites below.
    "connect-src 'self' https://www.google-analytics.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
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
