import { describe, expect, test } from "bun:test";
import { allowHit, clientIp } from "./rate-limit";

const req = (forwarded?: string) =>
  new Request("http://api.test/x", forwarded ? { headers: { "x-forwarded-for": forwarded } } : {});

/** Stands in for Bun's server; returns the socket peer, i.e. our own proxy. */
const socket = (address: string) => ({ requestIP: () => ({ address }) });

describe("clientIp", () => {
  test("falls back to the socket address when nothing is forwarded", () => {
    expect(clientIp(req(), socket("10.0.0.5"))).toBe("10.0.0.5");
  });

  test("falls back when there is no server at all", () => {
    expect(clientIp(req(), null)).toBe("unknown");
  });

  test("prefers the forwarded address over the proxy's socket address", () => {
    // The whole point: without this, every storefront request looks like it
    // came from the one frontend container.
    expect(clientIp(req("203.0.113.9"), socket("10.0.0.5"))).toBe("203.0.113.9");
  });

  /**
   * nginx appends the real peer to whatever the client sent
   * (`$proxy_add_x_forwarded_for`), so the trusted entry is the LAST one.
   * A spoofed prefix only makes the chain longer — it can't shift the
   * position we read, which is what makes the header safe to trust here.
   */
  test("reads the trusted hop from the right, ignoring a spoofed prefix", () => {
    expect(clientIp(req("1.2.3.4, 203.0.113.9"), socket("10.0.0.5"))).toBe("203.0.113.9");
    expect(clientIp(req("evil, 9.9.9.9, 203.0.113.9"), socket("10.0.0.5"))).toBe("203.0.113.9");
  });

  test("tolerates the spacing variations proxies produce", () => {
    expect(clientIp(req("1.2.3.4,203.0.113.9"), socket("10.0.0.5"))).toBe("203.0.113.9");
    expect(clientIp(req("  203.0.113.9  "), socket("10.0.0.5"))).toBe("203.0.113.9");
  });

  test("an empty header falls back rather than keying everyone as ''", () => {
    expect(clientIp(req(" , "), socket("10.0.0.5"))).toBe("10.0.0.5");
  });

  test("two clients behind one proxy get separate buckets", () => {
    const a = clientIp(req("198.51.100.1"), socket("10.0.0.5"));
    const b = clientIp(req("198.51.100.2"), socket("10.0.0.5"));
    expect(a).not.toBe(b);
  });
});

describe("allowHit", () => {
  test("allows up to the limit, then refuses", () => {
    const key = `test-${Math.random()}`;
    expect(allowHit(key, 3, 60_000)).toBe(true);
    expect(allowHit(key, 3, 60_000)).toBe(true);
    expect(allowHit(key, 3, 60_000)).toBe(true);
    expect(allowHit(key, 3, 60_000)).toBe(false);
  });

  test("keys are independent", () => {
    const a = `test-a-${Math.random()}`;
    const b = `test-b-${Math.random()}`;
    expect(allowHit(a, 1, 60_000)).toBe(true);
    expect(allowHit(a, 1, 60_000)).toBe(false);
    expect(allowHit(b, 1, 60_000)).toBe(true);
  });

  test("hits outside the window don't count", async () => {
    const key = `test-window-${Math.random()}`;
    expect(allowHit(key, 1, 20)).toBe(true);
    expect(allowHit(key, 1, 20)).toBe(false);
    await Bun.sleep(30);
    expect(allowHit(key, 1, 20)).toBe(true);
  });
});
