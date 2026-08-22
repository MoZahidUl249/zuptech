import { Value } from "@sinclair/typebox/value";
import { describe, expect, test } from "bun:test";
import { updateLandingPageDto } from "./landing-pages.dto";
import { updateContactDto, updateCopyDto } from "./content.dto";
import { createLeadDto } from "./leads.dto";
import { createOrderDto, updateOrderDto } from "./orders.dto";
import { updatePaymentMethodDto } from "./payments.dto";
import { quoteDto } from "./pricing.dto";
import { createProductDto, updateProductDto } from "./products.dto";
import { createStaffDto, permissionsDto } from "./staff.dto";

/**
 * Sanity checks that the DTO schemas actually reject bad payloads at the
 * edge — Elysia validates with these exact TypeBox schemas at runtime.
 */

const validOrder = {
  name: "Rahim Uddin",
  phone: "01712345678",
  address: "House 7, Road 3, Dhanmondi",
  insideDhaka: true,
  pay: "Cash on delivery",
  items: [{ productId: "ips1000", qty: 2 }],
};

describe("createOrderDto", () => {
  test("accepts a valid checkout payload", () => {
    expect(Value.Check(createOrderDto, validOrder)).toBe(true);
  });
  test("rejects an empty cart", () => {
    expect(Value.Check(createOrderDto, { ...validOrder, items: [] })).toBe(false);
  });
  test("rejects zero/negative/fractional quantities", () => {
    for (const qty of [0, -1, 1.5]) {
      const items = [{ productId: "ips1000", qty }];
      expect(Value.Check(createOrderDto, { ...validOrder, items })).toBe(false);
    }
  });
  test("rejects missing fields and unknown-shaped items", () => {
    const { pay: _pay, ...noPay } = validOrder;
    expect(Value.Check(createOrderDto, noPay)).toBe(false);
    expect(Value.Check(createOrderDto, { ...validOrder, items: [{ qty: 1 }] })).toBe(false);
  });
  test("caps qty at 99 and lines at 50 (cal-bk.md §3)", () => {
    expect(Value.Check(createOrderDto, { ...validOrder, items: [{ productId: "x", qty: 99 }] })).toBe(true);
    expect(Value.Check(createOrderDto, { ...validOrder, items: [{ productId: "x", qty: 100 }] })).toBe(false);
    const tooMany = Array(51).fill({ productId: "x", qty: 1 });
    expect(Value.Check(createOrderDto, { ...validOrder, items: tooMany })).toBe(false);
  });
});

describe("quoteDto", () => {
  const items = [{ productId: "ips1000", qty: 2 }];
  test("insideDhaka is optional (cart page) and allowed (checkout)", () => {
    expect(Value.Check(quoteDto, { items })).toBe(true);
    expect(Value.Check(quoteDto, { items, insideDhaka: true })).toBe(true);
  });
  test("rejects empty carts and out-of-range quantities", () => {
    expect(Value.Check(quoteDto, { items: [] })).toBe(false);
    expect(Value.Check(quoteDto, { items: [{ productId: "x", qty: 0 }] })).toBe(false);
    expect(Value.Check(quoteDto, { items: [{ productId: "x", qty: 100 }] })).toBe(false);
    expect(Value.Check(quoteDto, { items: [{ productId: "x", qty: 1.5 }] })).toBe(false);
  });
});

const validProduct = {
  name: "Voltage Protector 220V",
  slug: "voltage-protector-220v",
  categoryId: "cat_protection",
  price: 1650,
  minDepositPct: 20,
  onSale: false,
  salePct: 0,
  recommendedIds: [],
  deliveryFeeInsideDhaka: 60,
  deliveryFeeOutsideDhaka: 150,
  installationFeeInsideDhaka: 0,
  installationFeeOutsideDhaka: 0,
  warrantyMonths: 12,
  imgHint: "voltage protector photo",
  specs: ["Cuts off on high/low voltage"],
  description: "Protects appliances from voltage spikes.",
  sku: "ZT-VPR-40",
  cost: 1100,
  stock: 230,
  reserved: 12,
  reorderAt: 50,
  visible: true,
  photos: [],
};

describe("product DTOs", () => {
  test("accepts a valid product, with or without a video link", () => {
    expect(Value.Check(createProductDto, validProduct)).toBe(true);
    const withVideo = { ...validProduct, video: "https://youtu.be/abc123" };
    expect(Value.Check(createProductDto, withVideo)).toBe(true);
  });
  test("video must be an http(s) URL — empty string clears it", () => {
    expect(Value.Check(updateProductDto, { video: "" })).toBe(true);
    expect(Value.Check(updateProductDto, { video: "https://www.youtube.com/watch?v=x" })).toBe(true);
    expect(Value.Check(updateProductDto, { video: "not a url" })).toBe(false);
    expect(Value.Check(updateProductDto, { video: "ftp://example.com/clip.mp4" })).toBe(false);
  });
  test("categoryId is required on create — a product must have a category", () => {
    const { categoryId, ...withoutCategory } = validProduct;
    expect(Value.Check(createProductDto, withoutCategory)).toBe(false);
    expect(Value.Check(createProductDto, { ...withoutCategory, categoryId: "" })).toBe(false);
  });
  test("categoryId is optional on update, since PATCH is partial", () => {
    expect(Value.Check(updateProductDto, { categoryId: "cat_solar" })).toBe(true);
    expect(Value.Check(updateProductDto, { price: 100 })).toBe(true);
  });
  test("warrantyMonths accepts a period in months, 0 means no warranty", () => {
    expect(Value.Check(updateProductDto, { warrantyMonths: 0 })).toBe(true);
    expect(Value.Check(updateProductDto, { warrantyMonths: 24 })).toBe(true);
    expect(Value.Check(updateProductDto, { warrantyMonths: -1 })).toBe(false);
    expect(Value.Check(updateProductDto, { warrantyMonths: 241 })).toBe(false);
  });
  test("minDepositPct is a whole percentage, capped at 100", () => {
    expect(Value.Check(updateProductDto, { minDepositPct: 0 })).toBe(true);
    expect(Value.Check(updateProductDto, { minDepositPct: 20 })).toBe(true);
    expect(Value.Check(updateProductDto, { minDepositPct: 100 })).toBe(true);
    // The ceiling is the whole reason this field is validated: it was BDT
    // until 2026-08-13, where any positive integer was legitimate, and an
    // uncapped "percentage" renders as "340% down payment" on the product page.
    expect(Value.Check(updateProductDto, { minDepositPct: 101 })).toBe(false);
    expect(Value.Check(updateProductDto, { minDepositPct: -1 })).toBe(false);
    // A deposit is a whole percent — no 12.5% tiers to round later.
    expect(Value.Check(updateProductDto, { minDepositPct: 12.5 })).toBe(false);
  });
  test("recommendedIds is an ordered id list, and may be empty", () => {
    expect(Value.Check(updateProductDto, { recommendedIds: [] })).toBe(true);
    expect(Value.Check(updateProductDto, { recommendedIds: ["ips1000", "solar5k"] })).toBe(true);
    expect(Value.Check(updateProductDto, { recommendedIds: [""] })).toBe(false);
    expect(Value.Check(updateProductDto, { recommendedIds: "ips1000" })).toBe(false);
  });
  test("quantityOffers accepts valid tiers and rejects out-of-range values", () => {
    const offers = [
      { minQty: 3, amount: 500 },
      { minQty: 5, amount: 1200 },
    ];
    expect(Value.Check(createProductDto, { ...validProduct, quantityOffers: offers })).toBe(true);
    expect(Value.Check(updateProductDto, { quantityOffers: offers })).toBe(true);
    expect(Value.Check(updateProductDto, { quantityOffers: [{ minQty: 1, amount: 500 }] })).toBe(false);
    // A zero-Taka tier is not an offer.
    expect(Value.Check(updateProductDto, { quantityOffers: [{ minQty: 3, amount: 0 }] })).toBe(false);
    // No upper bound: a tier may exceed the price, and rules.ts floors the
    // resulting unit price at zero rather than the DTO guessing a ceiling it
    // cannot see the price for.
    expect(Value.Check(updateProductDto, { quantityOffers: [{ minQty: 3, amount: 99999 }] })).toBe(true);
    expect(Value.Check(updateProductDto, { quantityOffers: Array(11).fill({ minQty: 3, amount: 500 }) })).toBe(
      false,
    );
  });
  test("freeDeliveryOffers accepts valid tiers and rejects out-of-range values", () => {
    const tiers = [
      { minQty: 2, amount: 75 },
      { minQty: 5, amount: 350 }, // at or above the zone fee = free delivery
    ];
    expect(Value.Check(createProductDto, { ...validProduct, freeDeliveryOffers: tiers })).toBe(true);
    expect(Value.Check(updateProductDto, { freeDeliveryOffers: tiers })).toBe(true);
    expect(Value.Check(updateProductDto, { freeDeliveryOffers: [] })).toBe(true); // clears the ladder
    // A 1-unit "tier" is the base fee, not an offer.
    expect(Value.Check(updateProductDto, { freeDeliveryOffers: [{ minQty: 1, amount: 75 }] })).toBe(false);
    expect(Value.Check(updateProductDto, { freeDeliveryOffers: [{ minQty: 2, amount: 0 }] })).toBe(false);
    // Deliberately unbounded above: exceeding the fee is exactly how free
    // delivery is expressed, and the DTO can't know which zone fee applies.
    expect(Value.Check(updateProductDto, { freeDeliveryOffers: [{ minQty: 2, amount: 99999 }] })).toBe(true);
    expect(
      Value.Check(updateProductDto, { freeDeliveryOffers: Array(11).fill({ minQty: 2, amount: 75 }) }),
    ).toBe(false);
  });
  test("the two ladders are independent — sending one leaves the other alone", () => {
    expect(Value.Check(updateProductDto, { quantityOffers: [{ minQty: 3, amount: 500 }] })).toBe(true);
    expect(Value.Check(updateProductDto, { freeDeliveryOffers: [{ minQty: 3, amount: 350 }] })).toBe(true);
  });
});

describe("updateOrderDto", () => {
  test("only the five known statuses pass", () => {
    expect(Value.Check(updateOrderDto, { status: "On the way" })).toBe(true);
    expect(Value.Check(updateOrderDto, { status: "Shipped" })).toBe(false);
  });

  test("prepared-by can be set or explicitly cleared", () => {
    expect(Value.Check(updateOrderDto, { preparedById: "stf_123" })).toBe(true);
    expect(Value.Check(updateOrderDto, { preparedById: null })).toBe(true);
    expect(Value.Check(updateOrderDto, { preparedById: 7 })).toBe(false);
  });

  test("both fields are optional at the schema level", () => {
    // The handler rejects an empty body with 400 — the schema can't express
    // "at least one of", and doing it here would block a future third field.
    expect(Value.Check(updateOrderDto, {})).toBe(true);
  });
});

describe("staff DTOs", () => {
  test("usernames are shape-checked", () => {
    const staff = {
      name: "Test Person",
      username: "test.user-1",
      password: "secret1",
      roleId: "manager",
    };
    expect(Value.Check(createStaffDto, staff)).toBe(true);
    expect(Value.Check(createStaffDto, { ...staff, username: "bad name!" })).toBe(false);
    expect(Value.Check(createStaffDto, { ...staff, password: "short" })).toBe(false);
  });
  test("permission values are restricted to none/view/manage", () => {
    expect(Value.Check(permissionsDto, { orders: "view", staff: "manage" })).toBe(true);
    expect(Value.Check(permissionsDto, { orders: "admin" })).toBe(false);
  });
});

describe("updatePaymentMethodDto", () => {
  test("partial updates pass, unknown enum values fail", () => {
    expect(Value.Check(updatePaymentMethodDto, { enabled: false })).toBe(true);
    expect(Value.Check(updatePaymentMethodDto, { environment: "Staging" })).toBe(false);
  });
});

describe("createLeadDto", () => {
  const base = { serviceId: "svc_1", customer: "Karim Uddin" };

  test("accepts a booking with no address — it is optional now", () => {
    // The predecessor field (`city`) was required with a two-character
    // minimum, which is why the form used to post the string "Not given".
    expect(Value.Check(createLeadDto, base)).toBe(true);
  });

  test("accepts the full body the booking form sends", () => {
    expect(
      Value.Check(createLeadDto, {
        ...base,
        address: "House 12, Road 7, Dhanmondi",
        phone: "01711111111",
        email: "karim@example.com",
        notes: "Needs it before Eid.",
      }),
    ).toBe(true);
  });

  test("rejects a body with no customer", () => {
    expect(Value.Check(createLeadDto, { serviceId: "svc_1" })).toBe(false);
  });
});

describe("updateLandingPageDto — the campaign gallery", () => {
  /*
   * A t.Union of t.Literal, inside a t.Array, inside a t.Partial is the one
   * construct in this DTO worth pinning down: the renderer branches on `kind`,
   * so a value that slips through would put a photo inside a <video>.
   */
  test("accepts a mixed gallery", () => {
    expect(
      Value.Check(updateLandingPageDto, {
        galleryItems: [
          { url: "https://cdn.example/a.jpg", kind: "image", alt: "টুল সেট" },
          { url: "https://youtu.be/abc", kind: "video", alt: "" },
        ],
      }),
    ).toBe(true);
  });

  test("rejects a kind outside the union", () => {
    expect(
      Value.Check(updateLandingPageDto, {
        galleryItems: [{ url: "https://cdn.example/a.gif", kind: "gif", alt: "" }],
      }),
    ).toBe(false);
  });

  test("rejects a url with no scheme — it reaches next/image and <video src>", () => {
    expect(
      Value.Check(updateLandingPageDto, {
        galleryItems: [{ url: "cdn.example/a.jpg", kind: "image", alt: "" }],
      }),
    ).toBe(false);
    expect(Value.Check(updateLandingPageDto, { qcImages: ["cdn.example/a.jpg"] })).toBe(false);
  });

  test("accepts quality photos as plain URLs", () => {
    expect(
      Value.Check(updateLandingPageDto, {
        qcImages: ["https://cdn.example/1.jpg", "https://cdn.example/2.jpg"],
      }),
    ).toBe(true);
  });
});

/*
 * The contact screen had no coverage at all, and it is the one place where a
 * whole document is PUT on every save: `updateContactDto` is `t.Object`, not
 * `t.Partial`, so all fifteen keys are required every time. That makes one bad
 * value block every other field on the page — which is exactly what "Couldn't
 * save · Invalid request" turned out to be.
 *
 * These pin the boundaries the admin inputs now enforce (lib/admin-fields.ts).
 * If a limit changes here, that file has to change with it.
 */
describe("site contact + copy DTOs", () => {
  const contact = {
    phone: "+8801700000000",
    phoneDisplay: "+880 17 0000 0000",
    hotline: "09612-345678",
    email: "hello@zuptech.com.bd",
    whatsapp: "8801700000000",
    street: "House 00, Road 00, Banani",
    city: "Dhaka",
    postalCode: "1213",
    hours: "9am–8pm",
    officeName: "",
    warehouseName: "",
    warehouseAddress: "",
    hoursWeekday: "",
    hoursWeekend: "",
    hoursEmergency: "",
  };

  test("the document as the live site stores it is accepted", () => {
    expect(Value.Check(updateContactDto, contact)).toBe(true);
  });

  test("whatsapp takes bare digits only — a typed + is refused", () => {
    // The likeliest real cause of the reported failure: the field holds a
    // phone number, so "+880…" is the natural thing to type.
    expect(Value.Check(updateContactDto, { ...contact, whatsapp: "+8801700000000" })).toBe(false);
    expect(Value.Check(updateContactDto, { ...contact, whatsapp: "880 1700 000000" })).toBe(false);
    expect(Value.Check(updateContactDto, { ...contact, whatsapp: "8801700-000000" })).toBe(false);
    expect(Value.Check(updateContactDto, { ...contact, whatsapp: "" })).toBe(true);
  });

  test("every key is required — a partial write is refused outright", () => {
    // Not a hypothetical: the admin PUTs whatever it loaded, so a config from
    // a backend older than the frontend drops keys and blocks the whole screen.
    const { hoursEmergency: _dropped, ...missing } = contact;
    expect(Value.Check(updateContactDto, missing)).toBe(false);
    expect(Value.Check(updateContactDto, { whatsapp: "8801700000000" })).toBe(false);
  });

  test("null is not a string, however empty it looks", () => {
    expect(Value.Check(updateContactDto, { ...contact, officeName: null })).toBe(false);
  });

  test("the tight length caps are where the admin says they are", () => {
    expect(Value.Check(updateContactDto, { ...contact, phone: "1".repeat(20) })).toBe(true);
    expect(Value.Check(updateContactDto, { ...contact, phone: "1".repeat(21) })).toBe(false);
    expect(Value.Check(updateContactDto, { ...contact, hotline: "9".repeat(30) })).toBe(true);
    expect(Value.Check(updateContactDto, { ...contact, hotline: "9".repeat(31) })).toBe(false);
  });

  test("copy is partial, so one field may be sent alone", () => {
    expect(Value.Check(updateCopyDto, { contactTendersEmail: "mdabirmia625@gmail.com" })).toBe(true);
    // No email format anywhere — the address in the bug report was never the
    // problem, which is why the fix is to NAME the failing field, not guess it.
    expect(Value.Check(updateCopyDto, { contactTendersEmail: "not-an-email" })).toBe(true);
  });

  test("the service line is the tightest copy field at 40", () => {
    expect(Value.Check(updateCopyDto, { contactServiceLine: "x".repeat(40) })).toBe(true);
    expect(Value.Check(updateCopyDto, { contactServiceLine: "x".repeat(41) })).toBe(false);
    expect(Value.Check(updateCopyDto, { contactHeading: "x".repeat(120) })).toBe(true);
    expect(Value.Check(updateCopyDto, { contactHeading: "x".repeat(121) })).toBe(false);
  });
});

