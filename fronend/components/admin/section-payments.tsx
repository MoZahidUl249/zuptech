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
          Changes save automatically as you type.
        </p>
      ) : null}
    </Card>
  );
}
