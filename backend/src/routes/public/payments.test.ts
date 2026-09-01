import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * Settlement — the step that decides an order was paid for.
 *
 * The three things pinned here are the three that cost real money when wrong:
 * an order is confirmed only on the gateway's word, it is confirmed at most
 * once however many times the answer arrives, and an underpayment is never
 * quietly treated as a sale.
 *
 * ⚠️ Only `lib/db` is replaced. The EPS client and the status helper run for
 * real, against a scripted `fetch`.
 *
 * That is not fastidiousness, it is a bug fix. This file used to
 * `mock.module("../../lib/payments/eps")` and `mock.module("../../lib/order-status")`.
 * Bun applies a module mock to the WHOLE test run, not to one file, so
 * whenever this file happened to run first `eps.test.ts` silently tested the
 * stub instead of the real client — thirteen tests asserting nothing. It
 * passed locally, where the file order differed, and failed in CI. A mock that
 * can leak into another file's subject is worse than no mock, so the network
 * is scripted instead and everything above it is genuine.
 */

/* ===== Fakes ===== */

interface FakeTxn {
  merchantTxnId: string;
  orderId: string;
  methodId: string;
  amount: number;
  status: string;
  providerTxnId: string;
}

let txn: FakeTxn;
/** Every order status the settlement actually wrote. */
let statusWrites: { orderId: string; to: string }[] = [];
/** What the scripted gateway will say when asked about a transaction. */
let gatewayStatus: Record<string, unknown>;
let tokenCalls = 0;
let statusCalls = 0;

const order = () => ({
  id: "ZT-10241",
  status: "Processing",
  items: [{ productId: "p1", qty: 1 }],
});

const txClient = {
  paymentTransaction: {
    updateMany: async ({ where, data }: { where: { status: string }; data: Partial<FakeTxn> }) => {
      // Models the real WHERE: only an attempt still "Initiated" is claimable,
      // which is what makes a second caller a no-op instead of a second sale.
      if (txn.status !== where.status) return { count: 0 };
      Object.assign(txn, data);
      return { count: 1 };
    },
  },
  order: {
    findUnique: async () => order(),
    update: async ({ data }: { data: { status?: string } }) => {
      if (data.status) statusWrites.push({ orderId: order().id, to: data.status });
      return { ...order(), ...data, items: order().items };
    },
  },
  orderEvent: { create: async () => ({}) },
  // Processing → Confirmed leaves stock untouched (both states hold reserved
  // units), so these exist to fail loudly if that ever stops being true.
  product: {
    update: async () => {
      throw new Error("stock must not move on Processing → Confirmed");
    },
  },
  stockMovement: {
    create: async () => {
      throw new Error("no stock movement on Processing → Confirmed");
    },
  },
};

mock.module("../../lib/db", () => ({
  prisma: {
    $transaction: async (fn: (tx: typeof txClient) => Promise<unknown>) => fn(txClient),
    paymentTransaction: {
      findUnique: async ({ where }: { where: { merchantTxnId: string } }) =>
        where.merchantTxnId === txn.merchantTxnId ? { ...txn } : null,
      update: async ({ data }: { data: Partial<FakeTxn> }) => {
        Object.assign(txn, data);
        return { ...txn };
      },
    },
    paymentMethod: {
      findUnique: async () => ({
        id: "eps",
        provider: "EPS",
        environment: "Test",
        credentials: {
          merchantId: "m",
          storeId: "s",
          username: "u",
          password: "p",
          hashKey: "k",
        },
      }),
    },
  },
}));

const { settlePayment } = await import("./payments");

/** A gateway that answers the token call and then whatever is scripted. */
const realFetch = globalThis.fetch;
function gateway() {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("GetToken")) {
      tokenCalls += 1;
      return new Response(JSON.stringify({ token: "t-1" }), { status: 200 });
    }
    statusCalls += 1;
    return new Response(JSON.stringify(gatewayStatus), { status: 200 });
  }) as unknown as typeof fetch;
}

const paid = (amount: number) => ({
  MerchantTransactionId: "txn-abc",
  Status: "Success",
  EPSTransactionId: "eps-9",
  TotalAmount: String(amount),
  FinancialEntity: "bKash",
});

beforeEach(() => {
  txn = {
    merchantTxnId: "txn-abc",
    orderId: "ZT-10241",
    methodId: "eps",
    amount: 4500,
    status: "Initiated",
    providerTxnId: "",
  };
  gatewayStatus = paid(4500);
  statusWrites = [];
  tokenCalls = 0;
  statusCalls = 0;
  gateway();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("settlePayment", () => {
  test("a paid transaction confirms the order and records the gateway's id", async () => {
    const result = await settlePayment("txn-abc");

    expect(result).toEqual({ paid: true, status: "Paid" });
    expect(statusWrites).toEqual([{ orderId: "ZT-10241", to: "Confirmed" }]);
    expect(txn.providerTxnId).toBe("eps-9");
  });

  test("settling twice confirms the order once", async () => {
    await settlePayment("txn-abc");
    const second = await settlePayment("txn-abc");

    expect(second).toEqual({ paid: true, status: "Paid" });
    // The order moved once. A second move is not a duplicate row somewhere —
    // it is stock deducted twice for one sale.
    expect(statusWrites).toHaveLength(1);
    // And the settled attempt is answered from the row, without asking EPS again.
    expect(statusCalls).toBe(1);
  });

  test("a failed payment leaves the order alone", async () => {
    gatewayStatus = { MerchantTransactionId: "txn-abc", Status: "Failed" };

    const result = await settlePayment("txn-abc");

    expect(result.paid).toBe(false);
    expect(txn.status).toBe("Failed");
    expect(statusWrites).toEqual([]);
  });

  test("a cancelled payment is recorded as cancelled, not as a failure", async () => {
    gatewayStatus = { MerchantTransactionId: "txn-abc", Status: "Cancelled" };

    await settlePayment("txn-abc");

    expect(txn.status).toBe("Cancelled");
  });

  test("an unknown transaction stays open so a later check can settle it", async () => {
    // EPS answers without the echo when it has never heard of the id.
    gatewayStatus = {};

    const result = await settlePayment("txn-abc");

    // Writing "Failed" here would strand a customer who is still on the
    // gateway's page — they finish paying and we have already given up.
    expect(result.status).toBe("Initiated");
    expect(txn.status).toBe("Initiated");
    expect(statusWrites).toEqual([]);
  });

  test("underpayment is refused and never confirms the order", async () => {
    gatewayStatus = paid(500);

    expect(settlePayment("txn-abc")).rejects.toThrow(/less than the order total/);
    expect(statusWrites).toEqual([]);
  });

  test("overpayment still confirms — the customer is not owed a failure", async () => {
    gatewayStatus = paid(5000);

    const result = await settlePayment("txn-abc");

    expect(result.paid).toBe(true);
    expect(statusWrites).toHaveLength(1);
  });

  test("the gateway is asked once per settlement, with its token", async () => {
    await settlePayment("txn-abc");

    expect(tokenCalls).toBe(1);
    expect(statusCalls).toBe(1);
  });
});
