import { beforeAll, describe, expect, test } from "bun:test";

/**
 * These pin the two rules that stop a bad URL breaking a page.
 *
 * `isOptimizableImageSrc` has to agree with `images.remotePatterns` in
 * next.config.ts, because disagreeing in the optimistic direction is how a
 * page returns 500: the loader throws on a host it was not configured for, and
 * in a server component that is the whole page, not a broken picture.
 *
 * `cloudinaryWidth` has to leave stored values alone. The backend recovers a
 * Cloudinary `public_id` by stripping the exact transform it issued, so a URL
 * written back with a different width could never be deleted again.
 */

const CLOUD = "cum8k5j2";
const BASE = `https://res.cloudinary.com/${CLOUD}/image/upload`;
const TRANSFORM = "c_limit,f_auto,q_auto,w_1600";
const ours = (tail = "v1/zuptech-prod/product/x/y.png") => `${BASE}/${TRANSFORM}/${tail}`;

let isOptimizableImageSrc: typeof import("./images").isOptimizableImageSrc;
let cloudinaryWidth: typeof import("./images").cloudinaryWidth;
let looksLikeImageUrl: typeof import("./images").looksLikeImageUrl;

beforeAll(async () => {
  // Set before the first call — the module reads the variable lazily so a test
  // can stand in for the deployed environment.
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = CLOUD;
  ({ isOptimizableImageSrc, cloudinaryWidth, looksLikeImageUrl } = await import("./images"));
});

describe("isOptimizableImageSrc", () => {
  test("our own account's delivery path is optimizable", () => {
    expect(isOptimizableImageSrc(ours())).toBe(true);
  });

  test("a local asset is optimizable", () => {
    expect(isOptimizableImageSrc("/images/zup-mark.png")).toBe(true);
  });

  test("another Cloudinary account is NOT — this is the migration trap", () => {
    // The whole site 500s the day the cloud name changes if this returns true.
    expect(isOptimizableImageSrc(`https://res.cloudinary.com/someone-else/image/upload/v1/a.png`)).toBe(false);
  });

  test("any other host is NOT", () => {
    expect(isOptimizableImageSrc("https://upload.wikimedia.org/wikipedia/commons/4/47/x.png")).toBe(false);
  });

  test("a query string is NOT — remotePatterns sets search: \"\"", () => {
    expect(isOptimizableImageSrc(`${ours()}?v=2`)).toBe(false);
  });

  test("protocol-relative is not treated as local", () => {
    expect(isOptimizableImageSrc("//res.cloudinary.com/cum8k5j2/image/upload/v1/a.png")).toBe(false);
  });

  test("http is refused — the pattern is https only", () => {
    expect(isOptimizableImageSrc(`http://res.cloudinary.com/${CLOUD}/image/upload/v1/a.png`)).toBe(false);
  });

  test("empty, nullish and unparseable are all false", () => {
    for (const v of ["", "   ", null, undefined, "not a url"]) {
      expect(isOptimizableImageSrc(v)).toBe(false);
    }
  });
});

describe("cloudinaryWidth", () => {
  test("swaps the baked-in width on our own URL", () => {
    expect(cloudinaryWidth(ours(), 400)).toBe(
      `${BASE}/c_limit,f_auto,q_auto,w_400/v1/zuptech-prod/product/x/y.png`,
    );
  });

  test("leaves the rest of the path — version, folders, filename — untouched", () => {
    const tail = "v1786878058/zuptech-prod/product/bir38piecestoolsetwi/tvsmdall.png";
    expect(cloudinaryWidth(ours(tail), 400)).toContain(tail);
  });

  test("a foreign URL comes back byte-identical", () => {
    const foreign = "https://upload.wikimedia.org/wikipedia/commons/4/47/x.png";
    expect(cloudinaryWidth(foreign, 400)).toBe(foreign);
  });

  test("a URL without our transform is left alone rather than guessed at", () => {
    const noTransform = `${BASE}/v1/zuptech-prod/product/x/y.png`;
    expect(cloudinaryWidth(noTransform, 400)).toBe(noTransform);
  });

  test("the result is still optimizable — a narrowed URL must not become a 500", () => {
    expect(isOptimizableImageSrc(cloudinaryWidth(ours(), 400))).toBe(true);
  });
});

describe("looksLikeImageUrl", () => {
  test("raster extensions are pictures", () => {
    for (const ext of ["jpg", "jpeg", "png", "webp", "gif", "avif", "svg"]) {
      expect(looksLikeImageUrl(`https://example.test/a.${ext}`)).toBe(true);
    }
  });

  test("uppercase extensions count too", () => {
    expect(looksLikeImageUrl("https://example.test/A.PNG")).toBe(true);
  });

  test("video files and extensionless URLs are not pictures", () => {
    for (const u of [
      "https://example.test/a.mp4",
      "https://example.test/a.webm",
      "https://example.test/a.mov",
      "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      "https://example.test/no-extension",
    ]) {
      expect(looksLikeImageUrl(u)).toBe(false);
    }
  });

  test("a query string does not hide the extension", () => {
    expect(looksLikeImageUrl("https://example.test/a.png?w=10")).toBe(true);
  });

  test("empty and nullish are not pictures", () => {
    for (const v of ["", "  ", null, undefined]) expect(looksLikeImageUrl(v)).toBe(false);
  });
});
