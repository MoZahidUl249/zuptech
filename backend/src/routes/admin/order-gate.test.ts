import { beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * The courier gate.
 *
 * `On the way` and `Delivered` are claims that a parcel is physically moving.
 * Before this gate either could be set on a brand-new order in one click,
 * consuming stock and starting warranty cover for goods nobody had arranged to
 * send.
 *
 * The test worth having most is the LAST one: the gate must not reach the
 * shared status helper, because a paid EPS order confirms itself with no human
 * present and must never fail for want of a courier.
 */

let shipmentRow: { id: string } | null = null;
let orderStatus = "Confirmed";
/** Every status the route actually wrote. */
let written: string[] = [];

/**
 * Shaped to survive serialization, not just the handler.
 *
 * A thinner fixture passed the guard and then 500'd in `toOrderDetail`, which
 * reads `createdAt`, the product on every line, and the relation counts. A
 * route test that cannot render its own response is testing half the route.
 */
const order = () => ({
  id: "ZT-10241",
  number: 10241,
  customerId: "c1",
  name: "Rahim Uddin",
  phone: "01712345678",
  address: "Mirpur, Inside Dhaka",
  insideDhaka: true,
  subtotal: 1000,
  deliveryFee: 100,
  installationFee: 0,
  total: 1100,
  pay: "Cash on Delivery",
  status: orderStatus,
  preparedById: null,
  preparedBy: null,
  landingPageId: null,
  createdAt: new Date("2026-09-01T10:00:00Z"),
  updatedAt: new Date("2026-09-01T10:00:00Z"),
  items: [
    {
      id: 1,
      orderId: "ZT-10241",
      productId: "p1",
      qty: 1,
      unitPrice: 1000,
      deliveryFee: 100,
      installationFee: 0,
      product: { name: "Test product", sku: "SKU-1", slug: "test-product" },
    },
  ],
  invoice: null,
  warranties: [],
  events: [],
  _count: { warranties: 0 },
});

const tx = {
  order: {
    findUnique: async () => order(),
    findUniqueOrThrow: async () => order(),
    update: async ({ data }: { data: { status?: string } }) => {
      if (data.status) written.push(data.status);
      return { ...order(), ...data };
    },
  },
  orderEvent: { create: async () => ({}) },
  invoice: { findUnique: async () => null },
  product: { update: async () => ({}), findUnique: async () => ({ stock: 5, reserved: 1 }) },
  stockMovement: { create: async () => ({}) },
  warranty: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
  counter: { upsert: async () => ({ value: 1 }) },
  $executeRaw: async () => 1,
};

mock.module("../../lib/db", () => ({
  prisma: {
    $queryRaw: async () => [{ "?column?": 1 }],
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    staff: { findUnique: async () => staffRow },
    order: { findUnique: async () => order() },
    // The gate's own lookup.
    shipment: { findUnique: async () => shipmentRow },
    courier: { findMany: async () => [] },
  },
}));

let staffRow: {
  id: string;
  name: string;
  username: string;
  phone: string;
  email: string | null;
  role: { id: string; name: string; isSystem: boolean; permissions: Record<string, string> };
} | null = null;

mock.module("../../lib/auth", () => ({
  auth: { api: { getSession: async () => ({ user: { id: "u1" } }) } },
}));

const { createApp } = await import("../../app");
const app = createApp({ quiet: true });

async function patch(status: string) {
  const res = await app.handle(
    new Request("http://localhost/admin/api/orders/ZT-10241", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    }),
  );
  return { status: res.status, body: (await res.json()) as { error?: string } };
}

beforeEach(() => {
  shipmentRow = null;
  orderStatus = "Confirmed";
  written = [];
  staffRow = {
    id: "s1",
    name: "Test Staff",
    username: "test",
    phone: "01700000000",
    email: null,
    role: {
      id: "r1",
      name: "Tester",
      isSystem: false,
      permissions: { orders: "manage", warranty: "manage", invoices: "manage" },
    },
  };
});

describe("an order cannot reach the customer without a courier", () => {
  test("On the way is refused, and the message says how to fix it", async () => {
    const { status, body } = await patch("On the way");

    expect(status).toBe(400);
    expect(body.error).toContain("no courier yet");
    // The fix has to be in the message: whoever hits this is mid-task and
    // should not have to go looking for what "Own delivery" is.
    expect(body.error).toContain("Own delivery");
    expect(written).toEqual([]);
  });

  test("Delivered is refused too — it is the expensive one", async () => {
    const { status } = await patch("Delivered");

    expect(status).toBe(400);
    // Nothing was written, so no stock moved and no warranty was created.
    expect(written).toEqual([]);
  });

  test("with a shipment on file, the move goes through", async () => {
    shipmentRow = { id: "sh1" };

    const { status } = await patch("On the way");

    expect(status).toBe(200);
    expect(written).toContain("On the way");
  });

  test("Cancelled never needs a courier — nothing is going anywhere", async () => {
    const { status } = await patch("Cancelled");

    expect(status).toBe(200);
    expect(written).toContain("Cancelled");
  });

  test("moving backwards is still allowed, so a mistake can be undone", async () => {
    orderStatus = "Delivered";

    const { status } = await patch("Confirmed");

    expect(status).toBe(200);
    expect(written).toContain("Confirmed");
  });

  /*
   * The regression this whole design is shaped around.
   *
   * EPS confirms a paid order with no human present. Had the gate gone into
   * lib/order-status.ts instead of this route, a successful payment would fail
   * for want of a courier — the customer's money taken, their order stuck.
   */
  test("confirming an order needs no courier", async () => {
    orderStatus = "Processing";

    const { status } = await patch("Confirmed");

    expect(status).toBe(200);
    expect(written).toContain("Confirmed");
  });
});
