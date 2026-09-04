"use client";

import { useState } from "react";
import { useAdmin, type SmsSettings } from "@/lib/admin";
import { Card, KpiCard, Field, Pill, Toggle, BtnGhost, inputCls } from "./ui";

/**
 * Text messages to customers.
 *
 * Four messages, each its own switch, because each one costs money every time
 * it goes out — turning one on is a spending decision, not a preference.
 *
 * Same credential discipline as the Payment screen: what is shown is a mask,
 * and leaving a field untouched keeps the stored value.
 */

const MESSAGES: {
  key: keyof Pick<
    SmsSettings,
    "otpEnabled" | "placedEnabled" | "shippedEnabled" | "deliveredEnabled"
  >;
  label: string;
  help: string;
  sample: string;
}[] = [
  {
    key: "otpEnabled",
    label: "Password reset code",
    help: "Customers sign in with a phone number and most never give an email, so without this their password reset does nothing at all.",
    sample: "123456 is your ZUP TECH password reset code. It expires in 10 minutes…",
  },
  {
    key: "placedEnabled",
    label: "Order placed",
    help: "Sent the moment checkout succeeds — the message that stops a customer wondering whether it went through.",
    sample: "ZUP TECH: we have your order ZT-10241 for BDT 42,500. We will call you…",
  },
  {
    key: "shippedEnabled",
    label: "On its way",
    help: "Sent when the order is handed to a courier. Carries the tracking number when there is one.",
    sample: "ZUP TECH: order ZT-10241 is on its way with Steadfast. Tracking: TRK123.",
  },
  {
    key: "deliveredEnabled",
    label: "Delivered",
    help: "A thank-you when the parcel is marked delivered. The least load-bearing of the four — off by default.",
    sample: "ZUP TECH: order ZT-10241 has been delivered. Thank you for shopping with us.",
  },
];

export function MessagingSection() {
  const { state, update, can } = useAdmin();
  const readOnly = can("messaging") !== "manage";
  const sms = state.sms;

  const [showKey, setShowKey] = useState(false);

  const set = (patch: Partial<SmsSettings>) => update({ sms: { ...sms, ...patch } });

  const configured = Boolean(sms.username && sms.apiKey && sms.senderId);
  const liveCount = sms.enabled
    ? MESSAGES.filter((m) => sms[m.key]).length
    : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Texting" value={sms.enabled ? "On" : "Off"} />
        <KpiCard
          label="Messages switched on"
          value={`${liveCount} / ${MESSAGES.length}`}
        />
        <KpiCard
          label="Account"
          value={configured ? "Configured" : "Not set up"}
          tone={configured ? "muted" : "amber"}
          note={configured ? undefined : "Nothing sends until this is filled in"}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-ui-lg font-bold">Send text messages</h3>
            <p className="mt-0.5 text-ui-sm text-zup-gray">
              The master switch. Off means nothing is sent, whatever the individual
              messages below say.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Pill tone={sms.enabled ? "green" : "gray"}>{sms.enabled ? "On" : "Off"}</Pill>
            <Toggle
              on={sms.enabled}
              disabled={readOnly}
              onChange={(enabled) => set({ enabled })}
              label="Send text messages"
            />
          </div>
        </div>

        {!configured ? (
          <p className="mt-3 rounded-xl bg-warn-bg px-4 py-3 text-ui-sm">
            Fill in the MiM SMS account below first. Until then messages are written to
            the server log instead of being sent, so nothing is lost and nothing is
            charged.
          </p>
        ) : null}
      </Card>

      {MESSAGES.map((m) => (
        <Card key={m.key}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-[520px]">
              <h3 className="text-ui-base font-bold">{m.label}</h3>
              <p className="mt-1 text-ui-sm text-zup-gray">{m.help}</p>
              <p className="mt-2 rounded-lg bg-surface-sunken px-3 py-2 font-mono text-ui-xs text-zup-mid">
                {m.sample}
              </p>
            </div>
            <Toggle
              on={sms[m.key]}
              disabled={readOnly || !sms.enabled}
              onChange={(on) => set({ [m.key]: on } as Partial<SmsSettings>)}
              label={m.label}
            />
          </div>
        </Card>
      ))}

      <Card>
        <h3 className="text-ui-lg font-bold">MiM SMS account</h3>
        <p className="mt-0.5 text-ui-sm text-zup-gray">
          From your MiM SMS portal. The API key is generated under Developer Options; the
          sender name must match one already approved on the account, or every message is
          rejected.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Username (portal email)">
            <input
              value={sms.username}
              disabled={readOnly}
              onChange={(e) => set({ username: e.target.value })}
              className={`${inputCls} font-mono text-ui-sm`}
            />
          </Field>
          <Field label="Sender name">
            <input
              value={sms.senderId}
              disabled={readOnly}
              onChange={(e) => set({ senderId: e.target.value })}
              className={`${inputCls} font-mono text-ui-sm`}
            />
          </Field>
          <Field label="API key" className="sm:col-span-2">
            <div className="flex gap-2">
              <input
                type={showKey ? "text" : "password"}
                value={sms.apiKey}
                disabled={readOnly}
                onChange={(e) => set({ apiKey: e.target.value })}
                aria-label="API key"
                className={`${inputCls} min-w-0 flex-1 font-mono text-ui-sm`}
              />
              <BtnGhost onClick={() => setShowKey((v) => !v)} className="min-h-10 px-4">
                {showKey ? "Hide" : "Show"}
              </BtnGhost>
            </div>
          </Field>
          <Field label="API address" className="sm:col-span-2">
            <input
              value={sms.baseUrl}
              disabled={readOnly}
              onChange={(e) => set({ baseUrl: e.target.value })}
              className={`${inputCls} font-mono text-ui-sm`}
            />
            <p className="mt-1.5 text-xs text-zup-gray">
              Leave as-is unless MiM SMS tells you otherwise.
            </p>
          </Field>
        </div>

        {!readOnly ? (
          <p className="mt-4 text-xs font-semibold text-zup-soft">
            Nothing is sent until you press Save at the bottom of the screen — including
            the API key. What you see here is a mask, never the real credential.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
