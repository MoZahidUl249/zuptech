"use client";

import { useState } from "react";
import { testCourier } from "@/lib/admin-api";
import { useAdmin, type Courier, type CourierProvider } from "@/lib/admin";
import { Card, KpiCard, Field, Pill, Toggle, BtnGhost, inputCls, selectCls } from "./ui";

/**
 * Who carries your parcels.
 *
 * Three kinds, and the difference is how much of a delivery is automated:
 *
 *   Own delivery — your rider. Nothing is called; staff move the shipment.
 *   Integrated   — an API courier (Steadfast today). Booking and tracking
 *                  happen over its API.
 *   Other        — any courier without an integration. Staff type the
 *                  consignment number off the slip.
 *
 * Deliberately the same shape as the Payment screen: same enable switch, same
 * Live/Test environment, same write-only credentials. One pattern to learn.
 */

const KIND_LABEL: Record<Courier["kind"], string> = {
  self: "Own delivery",
  api: "Integrated courier",
  manual: "Other courier",
};

export function ShippingSection() {
  const { state, update, can } = useAdmin();
  const readOnly = can("shipping") !== "manage";

  const enabled = state.couriers.filter((c) => c.enabled);
  const integrated = enabled.filter((c) => c.kind === "api");
  const live = integrated.filter((c) => c.environment === "Live");

  const setCourier = (id: string, patch: Partial<Courier>) =>
    update({
      couriers: state.couriers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Ways to deliver" value={String(enabled.length)} />
        <KpiCard label="Integrated couriers" value={String(integrated.length)} />
        <KpiCard
          label="On live credentials"
          value={String(live.length)}
          /* Worth surfacing: an integrated courier still on Test credentials
             books nothing real, and the parcels quietly never get collected. */
          note={
            integrated.length > live.length
              ? `${integrated.length - live.length} still on Test`
              : undefined
          }
          tone={integrated.length > live.length ? "amber" : "muted"}
        />
      </div>

      {state.couriers.length === 0 ? (
        <Card>
          <p className="text-ui-sm text-zup-gray">
            No couriers configured yet. Run the seed, or add one from the database — the
            three defaults are your own delivery, Steadfast, and a manual courier.
          </p>
        </Card>
      ) : null}

      {state.couriers.map((c) => (
        <CourierCard
          key={c.id}
          c={c}
          spec={state.courierProviders.find((p) => p.id === c.provider.trim().toLowerCase())}
          readOnly={readOnly}
          onChange={(patch) => setCourier(c.id, patch)}
        />
      ))}

      {!readOnly ? (
        <p className="text-xs font-semibold text-zup-soft">
          Nothing is sent until you press Save at the bottom of the screen — including
          courier credentials.
        </p>
      ) : null}
    </div>
  );
}

function CourierCard({
  c,
  spec,
  readOnly,
  onChange,
}: {
  c: Courier;
  /** What this provider needs, as the backend declares it. */
  spec: CourierProvider | undefined;
  readOnly: boolean;
  onChange: (patch: Partial<Courier>) => void;
}) {
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const creds = c.credentials ?? {};

  const setCred = (key: string, value: string) =>
    onChange({ credentials: { ...creds, [key]: value } });

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      setResult((await testCourier(c.id)) as { ok: boolean; detail: string });
    } catch (err) {
      setResult({
        ok: false,
        detail: err instanceof Error ? err.message : "Could not run the check",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-ui-lg font-bold">{c.name}</h3>
          <p className="mt-0.5 text-ui-sm text-zup-gray">
            {KIND_LABEL[c.kind]}
            {c.provider ? ` · ${c.provider}` : ""}
            {typeof c.shipmentCount === "number" ? ` · ${c.shipmentCount} shipment(s)` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Pill tone={c.enabled ? "green" : "gray"}>{c.enabled ? "On" : "Off"}</Pill>
          <Toggle
            on={c.enabled}
            disabled={readOnly}
            onChange={(enabled) => onChange({ enabled })}
            label={`Enable ${c.name}`}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            value={c.name}
            disabled={readOnly}
            onChange={(e) => onChange({ name: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Environment">
          <select
            value={c.environment}
            disabled={readOnly}
            onChange={(e) => onChange({ environment: e.target.value as "Live" | "Test" })}
            className={selectCls}
          >
            <option>Live</option>
            <option>Test</option>
          </select>
          {/* Says what the switch really does for this provider, rather than
              implying a test server that may not exist. */}
          {spec ? <p className="mt-1.5 text-xs text-zup-gray">{spec.environmentNote}</p> : null}
        </Field>

        {/* Whatever this provider actually needs, named and explained. It used
            to be a hardcoded "API key" and "Secret key" for every courier,
            which is a guess the form had no way to get right. */}
        {c.kind === "api" && spec
          ? spec.fields.map((field) => (
              <Field key={field.key} label={field.label} className="sm:col-span-2">
                <div className="flex gap-2">
                  <input
                    type={field.secret && !shown[field.key] ? "password" : "text"}
                    value={creds[field.key] ?? ""}
                    disabled={readOnly}
                    onChange={(e) => setCred(field.key, e.target.value)}
                    aria-label={field.label}
                    className={`${inputCls} min-w-0 flex-1 font-mono text-ui-sm`}
                  />
                  {field.secret ? (
                    <BtnGhost
                      className="min-h-10 px-4"
                      onClick={() => setShown((v) => ({ ...v, [field.key]: !v[field.key] }))}
                    >
                      {shown[field.key] ? "Hide" : "Show"}
                    </BtnGhost>
                  ) : null}
                </div>
                <p className="mt-1.5 text-xs text-zup-gray">{field.help}</p>
              </Field>
            ))
          : null}

        {c.kind === "api" && !spec ? (
          <p className="rounded-xl bg-warn-bg px-4 py-3 text-ui-sm sm:col-span-2">
            No integration for &ldquo;{c.provider}&rdquo;. Bookings will be refused — set
            this courier to <strong>Other courier</strong> and record consignment numbers
            by hand, or use a supported provider.
          </p>
        ) : null}

        {c.kind === "api" ? (
          <Field label="API address" className="sm:col-span-2">
            <input
              value={c.baseUrl}
              disabled={readOnly}
              onChange={(e) => onChange({ baseUrl: e.target.value })}
              placeholder={spec?.defaultBaseUrl}
              className={`${inputCls} font-mono text-ui-sm`}
            />
            <p className="mt-1.5 text-xs text-zup-gray">
              Leave as-is unless {spec?.label ?? "the courier"} tells you otherwise.
            </p>
          </Field>
        ) : null}

        {c.kind !== "self" ? (
          <Field label="Tracking page" className="sm:col-span-2">
            <input
              value={c.trackingUrl}
              disabled={readOnly}
              onChange={(e) => onChange({ trackingUrl: e.target.value })}
              placeholder="https://courier.example/track/{code}"
              className={`${inputCls} font-mono text-ui-sm`}
            />
            <p className="mt-1.5 text-xs text-zup-gray">
              <code>{"{code}"}</code> is replaced with the tracking number. Leave empty if
              the courier has no tracking page — a broken link reads to a customer as a
              lost parcel.
            </p>
          </Field>
        ) : (
          <p className="text-ui-sm text-zup-gray sm:col-span-2">
            Nothing to configure — your own rider carries it, and staff move the delivery
            along by hand from the order.
          </p>
        )}
      </div>

      {c.kind === "api" && spec ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zup-body/8 pt-4">
          <BtnGhost className="min-h-10" disabled={testing} onClick={() => void runTest()}>
            {testing ? "Checking…" : "Check credentials"}
          </BtnGhost>
          <p className="text-xs text-zup-gray">
            Asks {spec.label} whether the <strong>saved</strong> credentials work. Save
            first if you have just edited them — nothing is shipped either way.
          </p>
          {result ? (
            <p
              className={`w-full rounded-xl px-4 py-3 text-ui-sm ${
                result.ok ? "bg-ok-bg text-ok-fg" : "bg-warn-bg text-destructive"
              }`}
            >
              {result.detail}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
