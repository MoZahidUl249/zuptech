import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { toMsisdn } from "../rules";
import { sendSms } from "./mimsms";
import { orderPlacedSms, orderShippedSms, otpSms } from "./templates";

/**
 * The SMS layer.
 *
 * What is worth pinning: that a switched-off message costs nothing, that a
 * provider failure cannot reach the caller, and that a 200 response saying
 * "failed" is treated as a failure.
 *
 * Only `lib/db` is mocked and the network is scripted. No `mock.module` on any
 * module under test — Bun applies those to the whole run, not one file, which
 * is how thirteen EPS tests silently asserted nothing against a stub on PR #9.
 */

let settings: Record<string, unknown>;
let sent: { url: string; body: Record<string, unknown> }[] = [];
let providerReply: Record<string, unknown> = { status: "Success", trxnId: "t-1" };
let providerHttpStatus = 200;

const CONFIGURED = {
  id: 1,
  enabled: true,
  provider: "mimsms",
  username: "shop@example.com",
  apiKey: "key-1",
  senderId: "ZUPTECH",
  baseUrl: "https://api.mimsms.com",
  otpEnabled: true,
  placedEnabled: true,
  shippedEnabled: true,
  deliveredEnabled: true,
};

mock.module("../db", () => ({
  prisma: {
    smsSettings: { upsert: async () => settings },
  },
}));

const { notify } = await import("./index");

const realFetch = globalThis.fetch;

beforeEach(() => {
  settings = { ...CONFIGURED };
  sent = [];
  providerReply = { status: "Success", trxnId: "t-1", responseResult: "SMS Send Successfuly" };
  providerHttpStatus = 200;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(input), body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response(JSON.stringify(providerReply), { status: providerHttpStatus });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("toMsisdn", () => {
  test("adds the country code to a local mobile", () => {
    expect(toMsisdn("01712345678")).toBe("8801712345678");
    expect(toMsisdn("01712-345 678")).toBe("8801712345678");
  });

  test("refuses anything that is not a valid local mobile", () => {
    // A malformed number must be dropped before it reaches a paid API.
    for (const bad of ["", "12345", "8801712345678", "0171234567", "notaphone"]) {
      expect(toMsisdn(bad)).toBe("");
    }
  });
});

describe("notify", () => {
  test("sends, in international form, with the transactional flag", async () => {
    const ok = await notify("placed", "01712345678", "hello");

    expect(ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toContain("/api/SmsSending/OneToMany");
    expect(sent[0]?.body).toMatchObject({
      MobileNumber: "8801712345678",
      SenderName: "ZUPTECH",
      Message: "hello",
      // Promotional traffic is blocked outside business hours and to DND
      // numbers — which is how a reset code silently fails to arrive at 11pm.
      TransactionType: "T",
    });
  });

  test("the master switch beats every per-message toggle", async () => {
    settings = { ...CONFIGURED, enabled: false };

    expect(await notify("otp", "01712345678", "code")).toBe(false);
    expect(sent).toEqual([]);
  });

  test("a switched-off message is not sent, and does not cost anything", async () => {
    settings = { ...CONFIGURED, deliveredEnabled: false };

    expect(await notify("delivered", "01712345678", "done")).toBe(false);
    expect(sent).toEqual([]);
    // Its neighbours are unaffected — each toggle is its own decision.
    expect(await notify("placed", "01712345678", "hi")).toBe(true);
  });

  test("missing credentials mean nothing is sent", async () => {
    for (const gap of [{ username: "" }, { apiKey: "" }, { senderId: "" }]) {
      settings = { ...CONFIGURED, ...gap };
      expect(await notify("placed", "01712345678", "hi")).toBe(false);
    }
    expect(sent).toEqual([]);
  });

  test("a configured-but-switched-off message never prints its body", async () => {
    /* The body is printed when there is no provider account at all — that is
       how the OTP flow stays testable with no spend. Once an account IS
       configured, printing it would write live reset codes into the server log
       of a production box because somebody flipped a toggle. */
    const logged: string[] = [];
    const realLog = console.log;
    console.log = (...args: unknown[]) => void logged.push(args.join(" "));

    /* Codes chosen so they are not substrings of the phone number itself —
       "123456" lives inside 8801712345678, which made the first version of
       this test pass against a log line that never held the code. */
    settings = { ...CONFIGURED, otpEnabled: false };
    await notify("otp", "01712345678", "909091 is your code");

    settings = { ...CONFIGURED, username: "", apiKey: "", senderId: "" };
    await notify("otp", "01712345678", "808082 is your code");

    console.log = realLog;

    const off = logged.find((l) => l.includes("switched off")) ?? "";
    const unconfigured = logged.find((l) => l.includes("not configured")) ?? "";

    expect(off).not.toContain("909091");
    expect(unconfigured).toContain("808082");
  });

  test("an invalid number never reaches the provider", async () => {
    expect(await notify("placed", "not-a-phone", "hi")).toBe(false);
    expect(sent).toEqual([]);
  });

  test("a provider outage is swallowed, never thrown at the caller", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    // The checkout that triggered this must not fail because a text message did.
    expect(await notify("placed", "01712345678", "hi")).toBe(false);
  });

  test("settings that cannot be read are swallowed too", async () => {
    settings = undefined as unknown as Record<string, unknown>;

    expect(await notify("placed", "01712345678", "hi")).toBe(false);
  });
});

describe("sendSms", () => {
  const config = {
    baseUrl: "https://api.mimsms.com/",
    username: "u",
    apiKey: "k",
    senderId: "S",
  };

  test('a 200 that says "failed" is a failure', async () => {
    // MiM answers 200 with a body that reports the outcome, so the HTTP status
    // alone is not the answer.
    providerReply = { status: "Failed", responseResult: "Invalid Sender Name" };

    const result = await sendSms(config, "8801712345678", "hi");

    expect(result.ok).toBe(false);
    expect(result.detail).toBe("Invalid Sender Name");
  });

  test("an HTTP error is a failure with the status in the detail", async () => {
    providerHttpStatus = 401;

    const result = await sendSms(config, "8801712345678", "hi");

    expect(result.ok).toBe(false);
    expect(result.detail).toBe("HTTP 401");
  });

  test("a trailing slash on the base URL does not double up", async () => {
    await sendSms(config, "8801712345678", "hi");

    expect(sent[0]?.url).toBe("https://api.mimsms.com/api/SmsSending/OneToMany");
  });
});

describe("templates", () => {
  test("the OTP message carries the code and warns against sharing", () => {
    const text = otpSms("123456");

    expect(text).toContain("123456");
    expect(text).toMatch(/do not share/i);
    // No link: a reset message with a URL in it teaches customers to click
    // exactly the thing a phisher will send them next.
    expect(text).not.toMatch(/https?:\/\//);
  });

  test("order messages name the order and stay within one GSM-7 segment", () => {
    // Over 160 characters is billed as two messages.
    for (const text of [
      orderPlacedSms("ZT-10241", 42500),
      orderShippedSms("ZT-10241", "Steadfast", "TRK123"),
      orderShippedSms("ZT-10241", "Own delivery", ""),
    ]) {
      expect(text).toContain("ZT-10241");
      expect(text.length).toBeLessThanOrEqual(160);
    }
  });

  test("no tracking code means no dangling 'Tracking:' label", () => {
    expect(orderShippedSms("ZT-10241", "Own delivery", "")).not.toContain("Tracking");
  });
});
