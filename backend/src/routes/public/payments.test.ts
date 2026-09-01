import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { EpsVerifyResult } from "../../lib/payments/eps";

/**
 * Settlement — the step that decides an order was paid for.
 *
 * The three things pinned here are the three that cost real money when wrong:
 * an order is confirmed only on the gateway's word, it is confirmed at most
 * once however many times the answer arrives, and an underpayment is never
 * quietly treated as a sale.
 *
 * `lib/db` and the EPS client are replaced, so this is the decision logic on
 * its own — no database, no network.
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
let verifyResult: EpsVerifyResult;
let verifyCalls = 0;
/** Every order status write the settlement asked for. */
let statusWrites: { orderId: string; to: string }[] = [];

const paidResult = (amount: number): EpsVerifyResult => ({
  paid: true,
  status: "success",
  providerTxnId: "eps-9",
  paidAmount: amount,
  method: "bKash",
  raw: { Status: "Success" },
});

mock.module("../../lib/db", () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient),
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

/** Inside a transaction the same rows are visible, plus the claim update. */
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
};

mock.module("../../lib/payments/eps", () => ({
  parseEpsCredentials: (raw: Record<string, string>) => raw,
  verifyPayment: async () => {
    verifyCalls += 1;
    return verifyResult;
  },
  initPayment: async () => ({ redirectUrl: "https://pay.eps/go", providerTxnId: "" }),
}));

mock.module("../../lib/order-status", () => ({
  setOrderStatus: async (_tx: unknown, orderId: string, to: string) => {
    statusWrites.push({ orderId, to });
    return true;
  },
}));

const { settlePayment } = await import("./payments");

beforeEach(() => {
  txn = {
    merchantTxnId: "txn-abc",
    orderId: "ZT-10241",
    methodId: "eps",
    amount: 4500,
    status: "Initiated",
    providerTxnId: "",
  };
  verifyResult = paidResult(4500);
  verifyCalls = 0;
  statusWrites = [];
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
    expect(verifyCalls).toBe(1);
  });

  test("a failed payment leaves the order alone", async () => {
    verifyResult = { ...paidResult(0), paid: false, status: "failed" };

    const result = await settlePayment("txn-abc");

    expect(result.paid).toBe(false);
    expect(txn.status).toBe("Failed");
    expect(statusWrites).toEqual([]);
  });

  test("a cancelled payment is recorded as cancelled, not as a failure", async () => {
    verifyResult = { ...paidResult(0), paid: false, status: "cancelled" };

    await settlePayment("txn-abc");

    expect(txn.status).toBe("Cancelled");
  });

  test("an unknown transaction stays open so a later check can settle it", async () => {
    verifyResult = { ...paidResult(0), paid: false, status: "unknown" };

    const result = await settlePayment("txn-abc");

    // Writing "Failed" here would strand a customer who is still on the
    // gateway's page — they finish paying and we have already given up.
    expect(result.status).toBe("Initiated");
    expect(txn.status).toBe("Initiated");
    expect(statusWrites).toEqual([]);
  });

  test("underpayment is refused and never confirms the order", async () => {
    verifyResult = paidResult(500);

    expect(settlePayment("txn-abc")).rejects.toThrow(/less than the order total/);
    expect(statusWrites).toEqual([]);
  });

  test("overpayment still confirms — the customer is not owed a failure", async () => {
    verifyResult = paidResult(5000);

    const result = await settlePayment("txn-abc");

    expect(result.paid).toBe(true);
    expect(statusWrites).toHaveLength(1);
  });
});
