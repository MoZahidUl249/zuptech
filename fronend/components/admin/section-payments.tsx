"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAdmin, type PaymentMethod } from "@/lib/admin";
import {
  Card,
  KpiCard,
  Field,
  Pill,
  Toggle,
  BtnGhost,
  inputCls,
  selectCls,
} from "./ui";

export function PaymentsSection() {
  const { state, update, can } = useAdmin();
  const readOnly = can("payments") !== "manage";

  const enabled = state.payments.filter((p) => p.enabled);
  const liveGateways = enabled.filter((p) => p.isGateway && p.environment === "Live");
  const testMode = enabled.filter((p) => p.isGateway && p.environment === "Test");

  const setMethod = (id: string, patch: Partial<PaymentMethod>) =>
    update({
      payments: state.payments.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3.5">
        <KpiCard
          label="Methods enabled"
          value={`${enabled.length} / ${state.payments.length}`}
        />
        <KpiCard label="Live gateways" value={String(liveGateways.length)} tone="green" />
        <KpiCard label="In test mode" value={String(testMode.length)} tone="amber" />
      </div>

      <p className="max-w-[560px] text-ui-sm leading-relaxed text-zup-gray">
        Which ways customers can pay at checkout. Keys and secrets are stored on the
        server and never reach the storefront. The list of methods is fixed — you can
        turn each one on or off and fill in its details.
      </p>

      {state.payments.map((m) => (
        <MethodCard
          key={m.id}
          method={m}
          readOnly={readOnly}
          onChange={(patch) => setMethod(m.id, patch)}
        />
      ))}

    </div>
  );
}

/*
 * This screen used to carry two "Delivery / installation pricing" cards — a
 * lazy drill-down over a Division → District → Upazila → Union tree, reading
 * and writing /admin/api/locations.
 *
 * That endpoint does not exist. There is no locations route under
 * backend/src/routes/admin/ and no LocationNode model in the schema; the UI
 * was built against a spec (cal-bk.md) that was never implemented, so both
 * cards could only ever show "Couldn't load locations". Delivery and
 * installation are actually priced from the inside/outside-Dhaka flag plus
 * each product's own fees (backend/src/lib/pricing.ts), which are edited on
 * the product itself.
 *
 * Removed rather than left in place: a screen that cannot work is worse than
 * no screen, and this redesign exists to remove exactly that kind of
 * confusion. If area-based pricing is wanted later it needs the backend
 * built first.
 */

function MethodCard({
  method: m,
  readOnly,
  onChange,
}: {
  method: PaymentMethod;
  readOnly: boolean;
  onChange: (patch: Partial<PaymentMethod>) => void;
}) {
  const [showSecret, setShowSecret] = useState(false);
  /* EPS is the one provider with a real integration behind it, and it needs
     five credentials rather than two. Keyed on the provider, not the row id,
     so a method renamed in the admin keeps its form. */
  const isEps = m.provider.trim().toLowerCase() === "eps";
  const [name, setName] = useState(m.name);

  return (
    <Card className="px-5 py-5 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-info-bg text-sm font-extrabold text-zup-blue">
          {m.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          {readOnly ? (
            <p className="text-ui-base font-bold">{m.name}</p>
          ) : (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && onChange({ name: name.trim() })}
              aria-label="Method name"
              className="w-full max-w-[280px] rounded-lg border border-transparent bg-transparent text-ui-base font-bold outline-none transition-colors focus:border-zup-blue focus:bg-white"
            />
          )}
          <p className="text-xs text-zup-soft">
            {m.kind} · {m.provider}
          </p>
        </div>
        <Pill tone={m.enabled ? (m.environment === "Live" ? "green" : "amber") : "gray"}>
          {m.enabled ? m.environment : "Off"}
        </Pill>
        <Toggle
          on={m.enabled}
          disabled={readOnly}
          label={`Enable ${m.name}`}
          onChange={(on) => {
            onChange({ enabled: on });
            toast(`${m.name} ${on ? "enabled" : "disabled"}`);
          }}
        />
      </div>

      {m.isGateway ? (
        <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
          <Field label="Provider">
            <select
              value={m.provider}
              disabled={readOnly}
              onChange={(e) => onChange({ provider: e.target.value })}
              className={selectCls}
            >
              {m.providers.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Environment">
            <select
              value={m.environment}
              disabled={readOnly}
              onChange={(e) => onChange({ environment: e.target.value as "Live" | "Test" })}
              className={selectCls}
            >
              <option>Live</option>
              <option>Test</option>
            </select>
          </Field>
          <Field label="API key / Store ID" className="sm:col-span-2">
            <input
              value={m.apiKey}
              disabled={readOnly}
              onChange={(e) => onChange({ apiKey: e.target.value })}
              className={`${inputCls} font-mono text-ui-sm`}
            />
          </Field>
          <Field label="API secret" className="sm:col-span-2">
            <div className="flex gap-2">
              <input
                type={showSecret ? "text" : "password"}
                value={m.apiSecret}
                disabled={readOnly}
                onChange={(e) => onChange({ apiSecret: e.target.value })}
                aria-label="API secret"
                className={`${inputCls} min-w-0 flex-1 font-mono text-ui-sm`}
              />
              <BtnGhost onClick={() => setShowSecret((s) => !s)} className="min-h-10 px-4">
                {showSecret ? "Hide" : "Show"}
              </BtnGhost>
            </div>
          </Field>
          {isEps ? <EpsCredentials m={m} readOnly={readOnly} onChange={onChange} /> : null}
          <Field label="Webhook / callback URL" className="sm:col-span-2">
            <input
              value={m.webhookUrl}
              disabled={readOnly}
              onChange={(e) => onChange({ webhookUrl: e.target.value })}
              placeholder="https://…"
              className={`${inputCls} font-mono text-ui-sm`}
            />
          </Field>
        </div>
      ) : (
        <p className="mt-3 text-ui-sm text-zup-gray">
          No API configuration needed — the rider collects payment on delivery.
        </p>
      )}

      {!readOnly ? (
        <p className="mt-4 text-xs font-semibold text-zup-soft">
          Nothing is sent until you press Save at the bottom of the screen — including the API secret.
        </p>
      ) : null}
    </Card>
  );
}

/**
 * The five credentials EPS issues a merchant.
 *
 * They arrive masked and are write-only: leaving a field as the mask it came
 * back as means "keep what is stored", which is why the backend merges these
 * key by key instead of writing the object whole. Typing over one of them
 * therefore cannot wipe the other four.
 *
 * `hashKey` is the one that signs every request. It is treated like the API
 * secret — hidden by default — because a leaked hash key lets someone else
 * sign payments as this merchant.
 */
function EpsCredentials({
  m,
  readOnly,
  onChange,
}: {
  m: PaymentMethod;
  readOnly: boolean;
  onChange: (patch: Partial<PaymentMethod>) => void;
}) {
  const [showHash, setShowHash] = useState(false);
  const creds = m.credentials ?? {};

  const set = (key: string, value: string) =>
    onChange({ credentials: { ...creds, [key]: value } });

  const text = (key: string, label: string, wide = false) => (
    <Field key={key} label={label} className={wide ? "sm:col-span-2" : undefined}>
      <input
        value={creds[key] ?? ""}
        disabled={readOnly}
        onChange={(e) => set(key, e.target.value)}
        className={`${inputCls} font-mono text-ui-sm`}
      />
    </Field>
  );

  return (
    <>
      <p className="mt-1 text-ui-sm text-zup-gray sm:col-span-2">
        EPS credentials. Leave a field untouched to keep the stored value — what you
        see is a mask, never the real credential.
      </p>
      {text("merchantId", "EPS merchant ID")}
      {text("storeId", "EPS store ID")}
      {text("username", "EPS username")}
      <Field label="EPS password">
        <input
          type="password"
          value={creds.password ?? ""}
          disabled={readOnly}
          onChange={(e) => set("password", e.target.value)}
          aria-label="EPS password"
          className={`${inputCls} font-mono text-ui-sm`}
        />
      </Field>
      <Field label="EPS hash key" className="sm:col-span-2">
        <div className="flex gap-2">
          <input
            type={showHash ? "text" : "password"}
            value={creds.hashKey ?? ""}
            disabled={readOnly}
            onChange={(e) => set("hashKey", e.target.value)}
            aria-label="EPS hash key"
            className={`${inputCls} min-w-0 flex-1 font-mono text-ui-sm`}
          />
          <BtnGhost onClick={() => setShowHash((v) => !v)} className="min-h-10 px-4">
            {showHash ? "Hide" : "Show"}
          </BtnGhost>
        </div>
      </Field>
    </>
  );
}
