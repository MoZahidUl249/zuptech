import { afterEach, describe, expect, mock, test } from "bun:test";
import { createHmac } from "node:crypto";
import { ApiError } from "../http";
import { initPayment, parseEpsCredentials, verifyPayment } from "./eps";

/**
 * The EPS client, tested against a fake gateway.
 *
 * What is worth pinning here is the protocol, because every one of these
 * details is invisible until money is involved: the signature EPS checks, the
 * environment the request actually goes to, and — above all — that a response
 * only counts as "paid" when EPS says so in the one field that means it.
 */

const CREDS = {
  merchantId: "m-1",
  storeId: "s-1",
  username: "zuptech",
  password: "hunter2",
  hashKey: "k-1",
};

/** What EPS's own SDK computes: base64(HMAC-SHA512(data, hashKey)). */
const expectedHash = (data: string) =>
  createHmac("sha512", CREDS.hashKey).update(data).digest("base64");

interface Captured {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
}

let calls: Captured[] = [];

/** The nth captured request, asserted to exist — a missing one is a failure. */
function nth(index: number): Captured {
  const call = calls[index];
  if (!call) throw new Error(`expected at least ${index + 1} gateway call(s), got ${calls.length}`);
  return call;
}

/** Replace fetch with a scripted gateway. Returns the captured requests. */
function gateway(responses: Record<string, unknown>) {
  calls = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    const key = Object.keys(responses).find((k) => url.includes(k));
    return new Response(JSON.stringify(key ? responses[key] : {}), { status: 200 });
  }) as unknown as typeof fetch;
}

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  mock.restore();
});

const init = () =>
  initPayment({
    creds: CREDS,
    environment: "Test",
    merchantTxnId: "txn-abc",
    amount: 4500,
    customerName: "Rahim",
    customerEmail: "txn-abc@orders.zuptech.local",
    customerPhone: "01712345678",
    customerAddress: "Mirpur, Inside Dhaka",
    productName: "ZUP TECH order ZT-10241",
    ipAddress: "203.0.113.9",
    successUrl: "https://zupplus.com/checkout/payment/success?txn=txn-abc",
    failUrl: "https://zupplus.com/checkout/payment/failed?txn=txn-abc",
    cancelUrl: "https://zupplus.com/checkout/payment/cancelled?txn=txn-abc",
  });

describe("parseEpsCredentials", () => {
  test("names every missing field rather than failing at the HTTP call", () => {
    expect(() => parseEpsCredentials({ merchantId: "m", storeId: "s" })).toThrow(
      /missing username, password, hashKey/,
    );
  });

  test("blank strings count as missing", () => {
    expect(() => parseEpsCredentials({ ...CREDS, hashKey: "   " })).toThrow(/hashKey/);
  });

  test("trims what it accepts", () => {
    expect(parseEpsCredentials({ ...CREDS, storeId: " s-1 " }).storeId).toBe("s-1");
  });
});

describe("initPayment", () => {
  test("signs the token call with the username and the payment with the txn id", async () => {
    gateway({
      GetToken: { token: "t-1" },
      InitializeEPS: { TransactionId: "eps-9", RedirectURL: "https://pay.eps/go" },
    });

    await init();

    expect(nth(0).headers["x-hash"]).toBe(expectedHash(CREDS.username));
    expect(nth(1).headers["x-hash"]).toBe(expectedHash("txn-abc"));
    expect(nth(1).headers.authorization).toBe("Bearer t-1");
  });

  test("Test environment never touches the live host", async () => {
    gateway({
      GetToken: { token: "t-1" },
      InitializeEPS: { TransactionId: "eps-9", RedirectURL: "https://pay.eps/go" },
    });

    await init();

    for (const c of calls) expect(c.url).toStartWith("https://sandboxpgapi.eps.com.bd/");
  });

  test("sends our transaction id and the order total", async () => {
    gateway({
      GetToken: { token: "t-1" },
      InitializeEPS: { TransactionId: "eps-9", RedirectURL: "https://pay.eps/go" },
    });

    const result = await init();

    expect(nth(1).body).toMatchObject({
      merchantTransactionId: "txn-abc",
      totalAmount: 4500,
      merchantId: "m-1",
      storeId: "s-1",
    });
    expect(result).toEqual({ redirectUrl: "https://pay.eps/go", providerTxnId: "eps-9" });
  });

  test("an ErrorMessage is a failure even though the HTTP call succeeded", async () => {
    gateway({
      GetToken: { token: "t-1" },
      InitializeEPS: { ErrorMessage: "Store is inactive" },
    });

    expect(init()).rejects.toThrow(/Store is inactive/);
  });

  test("a 200 with no redirect URL is refused rather than returned empty", async () => {
    gateway({ GetToken: { token: "t-1" }, InitializeEPS: { TransactionId: "eps-9" } });

    expect(init()).rejects.toThrow(/did not return a redirect URL/);
  });

  test("a refused token never reaches the payment call", async () => {
    gateway({ GetToken: { message: "bad credentials" } });

    expect(init()).rejects.toThrow(/authentication was refused/);
    expect(calls).toHaveLength(1);
  });

  test("gateway trouble surfaces as 502, not as a 500 blamed on us", async () => {
    gateway({ GetToken: { token: "t-1" } });
    globalThis.fetch = (async () => new Response("nope", { status: 503 })) as unknown as typeof fetch;

    const err = await init().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).statusCode).toBe(502);
  });
});

describe("verifyPayment", () => {
  const verify = () => verifyPayment(CREDS, "Test", "txn-abc");

  test('only "success" is paid', async () => {
    gateway({
      GetToken: { token: "t-1" },
      CheckMerchantTransactionStatus: {
        MerchantTransactionId: "txn-abc",
        Status: "Success",
        EPSTransactionId: "eps-9",
        TotalAmount: "4500",
        FinancialEntity: "bKash",
      },
    });

    const result = await verify();

    expect(result.paid).toBe(true);
    expect(result.paidAmount).toBe(4500);
    expect(result.providerTxnId).toBe("eps-9");
    expect(result.method).toBe("bKash");
  });

  test("a pending or failed status is not paid, and reports no amount", async () => {
    for (const status of ["Pending", "Failed", "Cancelled", "Initiated"]) {
      gateway({
        GetToken: { token: "t-1" },
        CheckMerchantTransactionStatus: {
          MerchantTransactionId: "txn-abc",
          Status: status,
          TotalAmount: "4500",
        },
      });

      const result = await verify();
      expect(result.paid).toBe(false);
      // Nonzero here would let a caller "confirm" an unpaid order by reading
      // the amount instead of the flag.
      expect(result.paidAmount).toBe(0);
    }
  });

  test("an id EPS has never seen answers unknown, not failed", async () => {
    gateway({ GetToken: { token: "t-1" }, CheckMerchantTransactionStatus: {} });

    const result = await verify();

    expect(result.status).toBe("unknown");
    expect(result.paid).toBe(false);
  });

  test("asks about the transaction id it was given, and signs with it", async () => {
    gateway({
      GetToken: { token: "t-1" },
      CheckMerchantTransactionStatus: { MerchantTransactionId: "txn-abc", Status: "Success" },
    });

    await verify();

    expect(nth(1).url).toContain("merchantTransactionId=txn-abc");
    expect(nth(1).headers["x-hash"]).toBe(expectedHash("txn-abc"));
  });
});
