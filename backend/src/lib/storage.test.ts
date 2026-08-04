import { afterEach, describe, expect, test } from "bun:test";
import { parseCloudinaryRef } from "./storage";

const CLOUD = "zuptech-demo";

const original = process.env.CLOUDINARY_CLOUD_NAME;

afterEach(() => {
  // Restore rather than delete — an unrelated suite may rely on this.
  if (original === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
  else process.env.CLOUDINARY_CLOUD_NAME = original;
});

describe("parseCloudinaryRef", () => {
  test("reads an image ref, stripping transform + version + extension", () => {
    process.env.CLOUDINARY_CLOUD_NAME = CLOUD;
    const url = `https://res.cloudinary.com/${CLOUD}/image/upload/c_limit,f_auto,q_auto,w_1600/v1712345678/zuptech/product/ips1000/abc123.jpg`;
    expect(parseCloudinaryRef(url)).toEqual({
      publicId: "zuptech/product/ips1000/abc123",
      resourceType: "image",
    });
  });

  test("reads a video ref with its own transform string", () => {
    process.env.CLOUDINARY_CLOUD_NAME = CLOUD;
    const url = `https://res.cloudinary.com/${CLOUD}/video/upload/f_auto,q_auto/v1712345678/zuptech/product/ips1000/promo.mp4`;
    expect(parseCloudinaryRef(url)).toEqual({
      publicId: "zuptech/product/ips1000/promo",
      resourceType: "video",
    });
  });

  test("reads a ref with no transform segment (nothing to strip)", () => {
    process.env.CLOUDINARY_CLOUD_NAME = CLOUD;
    const url = `https://res.cloudinary.com/${CLOUD}/image/upload/v1712345678/zuptech/service/svc1/logo.png`;
    expect(parseCloudinaryRef(url)).toEqual({
      publicId: "zuptech/service/svc1/logo",
      resourceType: "image",
    });
  });

  test("returns null for URLs this account did not issue", () => {
    process.env.CLOUDINARY_CLOUD_NAME = CLOUD;
    expect(parseCloudinaryRef("https://youtube.com/watch?v=abc")).toBeNull();
    expect(parseCloudinaryRef("")).toBeNull();
    // Right host, wrong cloud name.
    expect(
      parseCloudinaryRef("https://res.cloudinary.com/someone-else/image/upload/v1/x.jpg"),
    ).toBeNull();
  });

  test("returns null when CLOUDINARY_CLOUD_NAME isn't configured", () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    expect(
      parseCloudinaryRef(`https://res.cloudinary.com/${CLOUD}/image/upload/v1/x.jpg`),
    ).toBeNull();
  });
});
