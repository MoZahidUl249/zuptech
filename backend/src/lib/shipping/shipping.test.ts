import { afterEach, describe, expect, test } from "bun:test";
import { SHIPMENT_STATUSES } from "../rules";
import { adapterFor } from "./index";
import { mapSteadfastStatus, steadfast } from "./steadfast";
import { ORDER_STATUS_FOR } from "./types";

/**
 * The courier layer.
 *
 * Two things here are worth a test more than the plumbing is. First, that an
 * unrecognised courier status is never guessed at — mapping a word we don't
 * know onto Delivered consumes stock and starts warranty cover for a parcel
 * still on a van. Second, that a returned parcel does not move the order:
 * refund-or-resend is a decision with money in it, and a courier's webhook
 * does not get to make it.
 */

const CONFIG = {
  credentials: { apiKey: "k", secretKey: "s" },
  environment: "Test" as const,
  baseUrl: "https://portal.steadfast.com.bd/api/v1",
};

let calls: { url: string; headers: Record<string, string>; body: unknown }[] = [];
const realFetch = globalThis.fetch;

function courier(response: unknown, status = 200) {
  calls = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return new Response(JSON.stringify(response), { status });
  }) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("adapterFor", () => {
  test("self and manual couriers have no adapter — booking them is a DB write", () => {
    expect(adapterFor("self", "")).toBeNull();
    expect(adapterFor("manual", "")).toBeNull();
  });

  test("an API courier we have no integration for is refused, not silently skipped", () => {
    // Returning null here would let the route "book" a parcel with Pathao by
    // writing a row and calling nobody.
    expect(() => adapterFor("api", "pathao")).toThrow(/No shipping integration/);
  });

  test("provider matching ignores case and padding", () => {
    expect(adapterFor("api", "  SteadFast ")).toBe(steadfast);
  });
});

describe("mapSteadfastStatus", () => {
  test("maps the states that matter", () => {
    expect(mapSteadfastStatus("pending")).toBe("Booked");
    expect(mapSteadfastStatus("delivered")).toBe("Delivered");
    expect(mapSteadfastStatus("partial_delivered")).toBe("Delivered");
    expect(mapSteadfastStatus("cancelled")).toBe("Cancelled");
    expect(mapSteadfastStatus("returned")).toBe("Returned");
  });

  test("is case- and padding-insensitive", () => {
    expect(mapSteadfastStatus("  DELIVERED ")).toBe("Delivered");
  });

  test("refuses to guess at a word it does not know", () => {
    // The whole point. A new Steadfast state must arrive as "no opinion", not
    // as whatever happens to be nearest in the map.
    expect(mapSteadfastStatus("teleported")).toBeNull();
    expect(mapSteadfastStatus("")).toBeNull();
  });
});

describe("ORDER_STATUS_FOR", () => {
  test("every shipment status has an explicit answer", () => {
    for (const status of SHIPMENT_STATUSES) {
      expect(status in ORDER_STATUS_FOR).toBe(true);
    }
  });

  test("delivery is the only thing that closes an order", () => {
    expect(ORDER_STATUS_FOR.Delivered).toBe("Delivered");
    expect(ORDER_STATUS_FOR["Picked up"]).toBe("On the way");
    expect(ORDER_STATUS_FOR["In transit"]).toBe("On the way");
  });

  test("a returned or cancelled parcel leaves the order to a human", () => {
    expect(ORDER_STATUS_FOR.Returned).toBeNull();
    expect(ORDER_STATUS_FOR.Cancelled).toBeNull();
    // Booking alone is not movement either — the parcel is still with us.
    expect(ORDER_STATUS_FOR.Booked).toBeNull();
  });
});

describe("steadfast.book", () => {
  const request = {
    orderId: "ZT-10241",
    recipientName: "Rahim",
    recipientPhone: "01712345678",
    recipientAddress: "Mirpur, Inside Dhaka",
    codAmount: 4500,
    note: "Call before delivery",
  };

  test("sends the order id as the invoice and the COD amount as given", async () => {
    courier({ consignment: { consignment_id: 991, tracking_code: "ABC123", status: "pending" } });

    const result = await steadfast.book(CONFIG, request);

    expect(calls[0]?.body).toMatchObject({
      invoice: "ZT-10241",
      recipient_phone: "01712345678",
      cod_amount: 4500,
    });
    expect(calls[0]?.headers["Api-Key"]).toBe("k");
    expect(calls[0]?.headers["Secret-Key"]).toBe("s");
    expect(result).toMatchObject({
      consignmentId: "991",
      trackingCode: "ABC123",
      status: "Booked",
    });
  });

  test("a zero COD is sent as zero, not omitted", async () => {
    courier({ consignment: { consignment_id: 1, tracking_code: "X" } });

    await steadfast.book(CONFIG, { ...request, codAmount: 0 });

    // An omitted cod_amount would let the courier fall back to its own
    // default and collect money for an order that is already paid.
    expect((calls[0]?.body as { cod_amount: number }).cod_amount).toBe(0);
  });

  test("a response with no consignment is a failure, not an empty booking", async () => {
    courier({ status: 400, message: "recipient_phone is invalid" });

    expect(steadfast.book(CONFIG, request)).rejects.toThrow(/recipient_phone is invalid/);
  });

  test("missing credentials are named before anything is sent", async () => {
    // Arms the fake and clears the log, so "no calls" below means this test
    // made none rather than inheriting an empty array.
    courier({ consignment: { consignment_id: 1 } });

    expect(
      steadfast.book({ ...CONFIG, credentials: { apiKey: "k" } }, request),
    ).rejects.toThrow(/missing secretKey/);
    expect(calls).toHaveLength(0);
  });

  test("courier trouble surfaces as 502", async () => {
    courier({}, 401);

    const err = await steadfast.book(CONFIG, request).catch((e) => e);
    expect(err.statusCode).toBe(502);
  });
});

describe("steadfast.track", () => {
  test("an unknown delivery status leaves the shipment alone", async () => {
    courier({ delivery_status: "something_new" });

    expect(await steadfast.track(CONFIG, "991")).toBeNull();
  });

  test("a known status comes back mapped", async () => {
    courier({ delivery_status: "delivered" });

    expect(await steadfast.track(CONFIG, "991")).toMatchObject({ status: "Delivered" });
  });

  test("the consignment id is escaped into the path", async () => {
    courier({ delivery_status: "pending" });

    await steadfast.track(CONFIG, "99 1/x");

    expect(calls[0]?.url).toContain("/status_by_cid/99%201%2Fx");
  });
});
