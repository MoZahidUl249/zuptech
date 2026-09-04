"use client";

import { useCallback, useEffect, useState } from "react";
import { Truck } from "lucide-react";
import {
  bookShipment,
  getShipment,
  patchShipment,
  syncShipment,
  type ShipmentStatus,
} from "@/lib/admin-api";
import { useAdmin, type Permission } from "@/lib/admin";
import { Card, Field, Pill, BtnPrimary, BtnGhost, inputCls, selectCls } from "./ui";

/**
 * Where this order's parcel is, and how to move it.
 *
 * Loaded on its own rather than folded into the order detail payload: most
 * orders have no shipment, and a 404 here is an ordinary answer ("not handed
 * to anyone yet"), not an error worth colouring the screen red over.
 *
 * What the card offers depends on the courier's kind:
 *   own delivery — assign a rider, then advance the status by hand
 *   integrated   — book over the API, then pull status back with Sync
 *   other        — type the consignment number off the slip, advance by hand
 */

interface Shipment {
  id: string;
  orderId: string;
  courierId: string;
  courierName: string;
  courierKind: "self" | "api" | "manual";
  consignmentId: string;
  trackingCode: string;
  trackingUrl: string;
  status: ShipmentStatus;
  codAmount: number;
  riderId: string | null;
  riderName: string | null;
  note: string;
  createdAt: string;
  events: { at: string; kind: string; detail: string; byName: string }[];
}

const STATUSES: ShipmentStatus[] = [
  "Booked",
  "Picked up",
  "In transit",
  "Delivered",
  "Returned",
  "Cancelled",
];

function tone(status: ShipmentStatus) {
  if (status === "Delivered") return "green" as const;
  if (status === "Returned" || status === "Cancelled") return "red" as const;
  if (status === "Booked") return "gray" as const;
  return "blue" as const;
}

export function ShipmentCard({
  orderId,
  permission,
  busy,
  run,
}: {
  orderId: string;
  permission: Permission;
  busy: boolean;
  run: (label: string, fn: () => Promise<unknown>) => Promise<void>;
}) {
  const { state } = useAdmin();
  const readOnly = permission !== "manage";

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);

  // Booking form
  const [courierId, setCourierId] = useState("");
  const [riderId, setRiderId] = useState("");
  const [consignmentId, setConsignmentId] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [note, setNote] = useState("");

  /* Same shape as OrderDetailView's loader: a promise chain rather than an
     async body, and abortable, so a fast back-navigation cannot set state on
     a card that is already gone. */
  const load = useCallback(
    (signal?: AbortSignal) =>
      getShipment(orderId)
        .then((data) => {
          if (!signal?.aborted) setShipment(data as Shipment);
        })
        .catch(() => {
          // Not shipped yet. The only other realistic cause is a role without
          // `shipping: view`, and that one renders nothing either way.
          if (!signal?.aborted) setShipment(null);
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        }),
    [orderId],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  if (permission === "none") return null;

  const couriers = state.couriers.filter((c) => c.enabled);
  const chosen = couriers.find((c) => c.id === courierId);
  const riders = state.staff;

  const reloadAfter = (label: string, fn: () => Promise<unknown>) =>
    run(label, async () => {
      await fn();
      await load();
    });

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2.5">
        <Truck className="h-5 w-5 text-zup-gray" strokeWidth={2} aria-hidden />
        <h3 className="text-ui-lg font-bold">Delivery</h3>
        {shipment ? <Pill tone={tone(shipment.status)}>{shipment.status}</Pill> : null}
      </div>

      {loading ? <p className="text-ui-sm text-zup-gray">Loading…</p> : null}

      {!loading && !shipment ? (
        readOnly ? (
          <p className="text-ui-sm text-zup-gray">Not handed to a courier yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Courier">
              <select
                value={courierId}
                onChange={(e) => setCourierId(e.target.value)}
                className={selectCls}
              >
                <option value="">Choose…</option>
                {couriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            {chosen?.kind === "self" ? (
              <Field label="Rider">
                <select
                  value={riderId}
                  onChange={(e) => setRiderId(e.target.value)}
                  className={selectCls}
                >
                  <option value="">Unassigned</option>
                  {riders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {chosen?.kind === "manual" ? (
              <>
                <Field label="Consignment number">
                  <input
                    value={consignmentId}
                    onChange={(e) => setConsignmentId(e.target.value)}
                    className={`${inputCls} font-mono text-ui-sm`}
                  />
                </Field>
                <Field label="Tracking code">
                  <input
                    value={trackingCode}
                    onChange={(e) => setTrackingCode(e.target.value)}
                    className={`${inputCls} font-mono text-ui-sm`}
                  />
                </Field>
              </>
            ) : null}

            <Field label="Note for the courier" className="sm:col-span-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. call before delivery"
                className={inputCls}
              />
            </Field>

            <div className="sm:col-span-2">
              <BtnPrimary
                disabled={!courierId || busy}
                onClick={() =>
                  reloadAfter(`Handed to ${chosen?.name ?? "courier"}`, () =>
                    bookShipment(orderId, {
                      courierId,
                      ...(riderId ? { riderId } : {}),
                      ...(consignmentId ? { consignmentId } : {}),
                      ...(trackingCode ? { trackingCode } : {}),
                      ...(note ? { note } : {}),
                    }),
                  )
                }
              >
                {chosen?.kind === "api" ? "Book with courier" : "Hand over"}
              </BtnPrimary>
              {chosen?.kind === "api" ? (
                <p className="mt-2 text-xs text-zup-gray">
                  This books the parcel with {chosen.name} for real. The amount to collect
                  is worked out from the order — zero if it was already paid online.
                </p>
              ) : null}
            </div>
          </div>
        )
      ) : null}

      {shipment ? (
        <>
          <dl className="grid gap-x-6 gap-y-2 text-ui-sm sm:grid-cols-2">
            <Row label="Courier" value={shipment.courierName} />
            <Row label="Collect at door" value={`৳${shipment.codAmount.toLocaleString()}`} />
            {shipment.riderName ? <Row label="Rider" value={shipment.riderName} /> : null}
            {shipment.consignmentId ? (
              <Row label="Consignment" value={shipment.consignmentId} mono />
            ) : null}
            {shipment.trackingCode ? (
              <Row label="Tracking" value={shipment.trackingCode} mono />
            ) : null}
            {shipment.note ? <Row label="Note" value={shipment.note} /> : null}
          </dl>

          {shipment.trackingUrl ? (
            <a
              href={shipment.trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-ui-sm font-semibold text-zup-blue hover:underline"
            >
              Open tracking page ↗
            </a>
          ) : null}

          {!readOnly ? (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <Field label="Status" className="min-w-45">
                <select
                  value={shipment.status}
                  disabled={busy}
                  onChange={(e) =>
                    reloadAfter("Delivery updated", () =>
                      patchShipment(shipment.id, {
                        status: e.target.value as ShipmentStatus,
                      }),
                    )
                  }
                  className={selectCls}
                >
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>

              {shipment.courierKind === "api" ? (
                <BtnGhost
                  disabled={busy}
                  className="min-h-10"
                  onClick={() =>
                    reloadAfter("Asked the courier", () => syncShipment(shipment.id))
                  }
                >
                  Sync with courier
                </BtnGhost>
              ) : null}
            </div>
          ) : null}

          {!readOnly && shipment.status === "Delivered" ? (
            <p className="mt-3 text-xs text-zup-gray">
              Marking this delivered has already closed the order, taken the stock and
              started warranty cover.
            </p>
          ) : null}

          {shipment.events.length > 0 ? (
            <ul className="mt-5 flex flex-col gap-2 border-t border-zup-body/8 pt-4">
              {shipment.events.map((e, i) => (
                <li key={i} className="text-ui-sm text-zup-gray">
                  <span className="font-semibold text-zup-body">{e.detail}</span>
                  {" · "}
                  {e.byName}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 sm:block">
      <dt className="text-zup-gray">{label}</dt>
      <dd className={mono ? "font-mono text-ui-sm font-semibold" : "font-semibold"}>{value}</dd>
    </div>
  );
}
