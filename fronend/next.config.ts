import path from "node:path";
import type { NextConfig } from "next";

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

// The real backend (see BACKEND.md / cal-bk.md / openapi.json). The frontend
// runs on :3001 and proxies all API traffic there, so the browser stays
// same-origin and the better-auth session cookie works unchanged.
export const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

// The media-storage service (../storage). Admin uploads (product photos, hero
// banners, service images) are served from here as absolute URLs, so
// next/image needs it allow-listed to optimize them.
const STORAGE_URL = process.env.NEXT_PUBLIC_STORAGE_URL ?? "http://localhost:3100";
const STORAGE_ORIGIN = new URL(STORAGE_URL);
/** True when storage is on this machine — i.e. the local dev setup. */
const IS_LOCAL_STORAGE = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(
  STORAGE_ORIGIN.hostname,
);

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
    // Explicit object form rather than `new URL(...)`: the storage host is
    // configurable, and spelling out protocol/hostname/port keeps the
    // allowlist readable when STORAGE_URL changes between environments.
    // `search: ""` keeps query strings blocked.
    remotePatterns: [
      {
        protocol: STORAGE_ORIGIN.protocol.replace(":", "") as "http" | "https",
        hostname: STORAGE_ORIGIN.hostname,
        port: STORAGE_ORIGIN.port,
        pathname: "/files/**",
        search: "",
      },
    ],
    // Next 16 refuses to optimize an upstream image whose host resolves to a
    // private IP — an SSRF guard. In local dev the media-storage service IS
    // on 127.0.0.1, so every admin image preview 400s without this.
    //
    // Scoped to local development on purpose: in staging/production
    // STORAGE_URL points at a public host, the guard does real work, and this
    // stays false. Never set it because a deployed image 400s — that error
    // means the URL is pointing somewhere it shouldn't.
    dangerouslyAllowLocalIP: IS_LOCAL_STORAGE && process.env.NODE_ENV === "development",
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
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
