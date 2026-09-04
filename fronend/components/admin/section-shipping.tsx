"use client";

import { useState } from "react";
import { useAdmin, type Courier } from "@/lib/admin";
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
  readOnly,
  onChange,
}: {
  c: Courier;
  readOnly: boolean;
  onChange: (patch: Partial<Courier>) => void;
}) {
  const [showSecret, setShowSecret] = useState(false);
  const creds = c.credentials ?? {};

  const setCred = (key: string, value: string) =>
    onChange({ credentials: { ...creds, [key]: value } });

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
        </Field>

        {c.kind === "api" ? (
          <>
            <Field label="API key" className="sm:col-span-2">
              <input
                value={creds.apiKey ?? ""}
                disabled={readOnly}
                onChange={(e) => setCred("apiKey", e.target.value)}
                className={`${inputCls} font-mono text-ui-sm`}
              />
            </Field>
            <Field label="Secret key" className="sm:col-span-2">
              <div className="flex gap-2">
                <input
                  type={showSecret ? "text" : "password"}
                  value={creds.secretKey ?? ""}
                  disabled={readOnly}
                  onChange={(e) => setCred("secretKey", e.target.value)}
                  aria-label="Secret key"
                  className={`${inputCls} min-w-0 flex-1 font-mono text-ui-sm`}
                />
                <BtnGhost onClick={() => setShowSecret((v) => !v)} className="min-h-10 px-4">
                  {showSecret ? "Hide" : "Show"}
                </BtnGhost>
              </div>
            </Field>
          </>
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
    </Card>
  );
}
