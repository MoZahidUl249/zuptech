import { prisma } from "../db";
import { toMsisdn } from "../rules";
import { sendSms, type MimSmsConfig } from "./mimsms";

/**
 * The one way anything in this codebase sends a text message.
 *
 * Three properties every caller depends on, and none of them should have to
 * think about:
 *
 *   It never throws. Every send is a notification ABOUT something that already
 *   happened — an order placed, a parcel handed over. A provider being down
 *   must never fail the checkout it was reporting on, so failures become log
 *   lines and nothing else.
 *
 *   It never sends what is switched off. Each message kind has its own toggle
 *   and there is a master switch above them, because every send costs money.
 *
 *   With no credentials it logs instead of sending — the same bargain
 *   `lib/mail.ts` makes for SMTP, which is what lets dev and CI exercise these
 *   paths with no account and no spend.
 *
 * Deliberately NOT called from inside a `prisma.$transaction`: an HTTP call
 * there holds a row lock for its duration, and a rollback cannot unsend a
 * message. Callers send after their transaction commits.
 */

export type SmsKind = "otp" | "placed" | "shipped" | "delivered";

/** Which stored toggle governs each kind. */
const TOGGLE: Record<SmsKind, "otpEnabled" | "placedEnabled" | "shippedEnabled" | "deliveredEnabled"> = {
  otp: "otpEnabled",
  placed: "placedEnabled",
  shipped: "shippedEnabled",
  delivered: "deliveredEnabled",
};

/**
 * The settings row, created on first read.
 *
 * An upsert rather than a seed dependency: a fresh database, a restored backup
 * and a half-run seed all behave the same, and an unconfigured install simply
 * sends nothing.
 */
export async function smsSettings() {
  return prisma.smsSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
}

/**
 * Everything needed to send, or why not.
 *
 * "Off" and "not set up" are kept apart because they are logged differently,
 * and the difference matters: see the note in `notify`.
 */
type Resolution =
  | { send: true; config: MimSmsConfig }
  | { send: false; reason: "off" | "unconfigured" };

async function resolve(kind: SmsKind): Promise<Resolution> {
  const settings = await smsSettings();

  if (!settings.username || !settings.apiKey || !settings.senderId) {
    return { send: false, reason: "unconfigured" };
  }
  if (!settings.enabled || !settings[TOGGLE[kind]]) {
    return { send: false, reason: "off" };
  }

  return {
    send: true,
    config: {
      baseUrl: settings.baseUrl,
      username: settings.username,
      apiKey: settings.apiKey,
      senderId: settings.senderId,
    },
  };
}

/**
 * Send one message of one kind. Fire and forget — the boolean is for tests and
 * for a caller that wants to log its own outcome, never for control flow.
 */
export async function notify(kind: SmsKind, phone: string, message: string): Promise<boolean> {
  const to = toMsisdn(phone);
  if (!to) {
    // A number that is not a valid local mobile never reaches a paid API.
    console.log(`[sms] ${kind}: skipped — "${phone}" is not a valid mobile number`);
    return false;
  }

  let resolution: Resolution;
  try {
    resolution = await resolve(kind);
  } catch (err) {
    console.error(`[sms] ${kind}: could not read settings`, err);
    return false;
  }

  if (!resolution.send) {
    /*
     * Two different situations, and only one of them may print the message.
     *
     *   unconfigured — no provider account at all, so this is a developer's
     *     machine or CI. Printing the body is the whole point: it is how the
     *     OTP flow stays testable with no account and no spend, the same
     *     bargain lib/mail.ts makes for SMTP.
     *
     *   off — the account IS configured and an operator switched this message
     *     off. That is a live system, and writing a live reset code into the
     *     server log because somebody turned a toggle off would be putting a
     *     credential somewhere it was never meant to go.
     */
    if (resolution.reason === "unconfigured") {
      console.log(`[sms] ${kind}: not configured — would send to ${to}: ${message}`);
    } else {
      console.log(`[sms] ${kind}: switched off — nothing sent to ${to}`);
    }
    return false;
  }

  try {
    const result = await sendSms(resolution.config, to, message);
    if (result.ok) {
      console.log(`[sms] ${kind}: sent to ${to} (trxn ${result.trxnId})`);
    } else {
      // Worth an error line: somebody is waiting for this message and it did
      // not arrive, and the provider's own wording is the fastest way to find
      // out why (bad sender id, no balance, blocked number).
      console.error(`[sms] ${kind}: provider refused for ${to} — ${result.detail}`);
    }
    return result.ok;
  } catch (err) {
    console.error(`[sms] ${kind}: send failed for ${to}`, err);
    return false;
  }
}

export * from "./templates";
