import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { COURIER_PROVIDERS, providerSpec } from "./providers";
import { steadfast } from "./steadfast";
import { adapterFor } from "./index";

/**
 * The provider registry, and the drift it exists to prevent.
 *
 * The registry says what the admin screen asks for; the adapter decides what it
 * reads. When those disagree the courier looks configured and refuses every
 * booking, and nothing says why until a customer's parcel does not go out. So
 * the agreement is asserted here rather than assumed.
 *
 * `fetch` is scripted; no module under test is mocked. Bun applies a module
 * mock to the whole run, which is how thirteen EPS tests silently checked a
 * stub on PR #9.
 */

const CONFIG = {
  credentials: { apiKey: "k", secretKey: "s" },
  environment: "Test" as const,
  baseUrl: "https://portal.steadfast.com.bd/api/v1",
};

let sent: { url: string; headers: Record<string, string> }[] = [];
let reply: unknown = { status: 200, current_balance: 1234 };
let httpStatus = 200;

const realFetch = globalThis.fetch;

beforeEach(() => {
  sent = [];
  reply = { status: 200, current_balance: 1234 };
  httpStatus = 200;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    sent.push({
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return new Response(JSON.stringify(reply), { status: httpStatus });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("the registry and the adapters agree", () => {
  test("every provider in the registry has an adapter", () => {
    for (const provider of COURIER_PROVIDERS) {
      expect(adapterFor("api", provider.id)).not.toBeNull();
    }
  });

  test("Steadfast's declared fields are exactly the ones it sends", async () => {
    /*
     * The assertion this file exists for.
     *
     * The screen renders whatever the registry declares. If a field were
     * renamed here without the adapter following — or vice versa — the admin
     * would fill in a credential nothing reads, and every booking would fail
     * with an auth error against a form that looks complete.
     */
    const declared = providerSpec("steadfast")?.fields.map((f) => f.key).sort();

    await steadfast.check?.(CONFIG);
    const headers = sent[0]?.headers ?? {};
    // Steadfast authenticates with exactly these two, under these header names.
    const used = ["apiKey", "secretKey"].sort();

    expect(declared).toEqual(used);
    expect(headers["Api-Key"]).toBe("k");
    expect(headers["Secret-Key"]).toBe("s");
  });

  test("a secret field is marked secret, so the form hides it", () => {
    const fields = providerSpec("steadfast")?.fields ?? [];
    expect(fields.find((f) => f.key === "secretKey")?.secret).toBe(true);
  });

  test("every field carries help — an unexplained credential is a support ticket", () => {
    for (const provider of COURIER_PROVIDERS) {
      for (const field of provider.fields) {
        expect(field.label.length).toBeGreaterThan(0);
        expect(field.help.length).toBeGreaterThan(0);
      }
    }
  });

  test("providerSpec is forgiving about case and padding, like adapterFor", () => {
    expect(providerSpec("  SteadFast ")?.id).toBe("steadfast");
    expect(providerSpec("pathao")).toBeNull();
  });
});

describe("the API address is configuration, not a constant", () => {
  test("requests go to the configured base URL", async () => {
    await steadfast.check?.({ ...CONFIG, baseUrl: "https://sink.local/v9" });

    // Proof the old hardcoded host is really gone.
    expect(sent[0]?.url).toBe("https://sink.local/v9/get_balance");
  });

  test("a blank base URL falls back to the provider's default", async () => {
    // A row created by hand, before the migration backfilled it.
    await steadfast.check?.({ ...CONFIG, baseUrl: "" });

    expect(sent[0]?.url).toStartWith("https://portal.steadfast.com.bd/api/v1");
  });

  test("a trailing slash does not double up", async () => {
    await steadfast.check?.({ ...CONFIG, baseUrl: "https://sink.local/v9/" });

    expect(sent[0]?.url).toBe("https://sink.local/v9/get_balance");
  });
});

describe("check", () => {
  test("good credentials report the balance", async () => {
    const result = await steadfast.check?.(CONFIG);

    expect(result?.ok).toBe(true);
    expect(result?.detail).toContain("1234");
  });

  test("it asks the cheapest endpoint, and books nothing", async () => {
    await steadfast.check?.(CONFIG);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toContain("/get_balance");
    expect(sent[0]?.url).not.toContain("create_order");
  });

  test("a rejected key is a report, not a throw", async () => {
    httpStatus = 401;

    const result = await steadfast.check?.(CONFIG);

    // The screen renders this; an exception here would surface as "something
    // went wrong" and lose the one detail worth having.
    expect(result?.ok).toBe(false);
    expect(result?.detail).toContain("401");
  });

  test("an unreachable host is a failure, not a crash", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ENOTFOUND");
    }) as unknown as typeof fetch;

    const result = await steadfast.check?.(CONFIG);

    expect(result?.ok).toBe(false);
    // Distinct from a bad key — which is the point of testing at all.
    expect(result?.detail).toMatch(/could not reach/i);
  });

  test("missing credentials are named before anything is sent", async () => {
    const result = await steadfast.check?.({ ...CONFIG, credentials: { apiKey: "k" } });

    expect(result?.ok).toBe(false);
    expect(result?.detail).toContain("secretKey");
    expect(sent).toEqual([]);
  });
});
