"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Truck } from "lucide-react";
import {
  bookShipment,
  getShipment,
  patchShipment,
  setOrderStatus,
  syncShipment,
  type ShipmentStatus,
} from "@/lib/admin-api";
import { useAdmin, type OrderStatus, type Permission } from "@/lib/admin";
import { Card, Field, Pill, BtnPrimary, BtnGhost, BtnDanger, inputCls, selectCls } from "./ui";

/**
 * Handling an order, one step at a time.
 *
 * This replaces a dropdown in the orders list that could take a brand-new
 * order straight to Delivered in one click — consuming stock and starting
 * warranty cover for goods nobody had arranged to send. There is now one
 * sequence, each stage has exactly one obvious next action, and the button
 * says what will happen rather than "Update".
 *
 *   1  Needs confirming   → Confirm & hand to courier   (courier REQUIRED)
 *   2  With the courier   → Mark picked up / Sync
 *   3  On the way         → Mark delivered / Sync
 *   4  Delivered          → done
 *
 * The courier is required at step 1 because that is the moment someone is
 * looking at the order and talking to the customer. The backend enforces the
 * same thing from the other end — nothing reaches On the way or Delivered
 * without a shipment on file — so this is guidance, not the boundary.
 *
 * Steps 2 and 3 move the SHIPMENT, not the order. The order follows on its
 * own (ORDER_STATUS_FOR on the backend), which keeps one source of truth for
 * where a parcel is instead of two that can disagree.
 */

interface Shipment {
  id: string;
  courierName: string;
  courierKind: "self" | "api" | "manual";
  consignmentId: string;
  trackingCode: string;
  trackingUrl: string;
  status: ShipmentStatus;
  codAmount: number;
  riderName: string | null;
  note: string;
  events: { at: string; kind: string; detail: string; byName: string }[];
}

interface OrderLike {
  id: string;
  status: OrderStatus;
  customer: string;
  phone: string;
  address: string;
  total: number;
}

const STEPS = ["Needs confirming", "With the courier", "On the way", "Delivered"] as const;

/** Which step an order is standing on. Cancelled stands outside the sequence. */
function stepOf(status: OrderStatus): number {
  if (status === "Processing") return 0;
  if (status === "Confirmed") return 1;
  if (status === "On the way") return 2;
  if (status === "Delivered") return 3;
  return -1;
}

const taka = (n: number) => `৳${n.toLocaleString("en-BD")}`;

export function OrderSteps({
  order,
  permission,
  busy,
  run,
  onChanged,
}: {
  order: OrderLike;
  permission: Permission;
  busy: boolean;
  run: (label: string, fn: () => Promise<unknown>) => Promise<void>;
  onChanged: () => void;
}) {
  const { state } = useAdmin();
  const readOnly = permission !== "manage";

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);

  const [courierId, setCourierId] = useState("");
  const [riderId, setRiderId] = useState("");
  const [consignmentId, setConsignmentId] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [note, setNote] = useState("");

  /* Promise chain rather than an async body, and abortable — the same shape
     OrderDetailView uses, and what keeps the set-state-in-effect lint rule
     satisfied. */
  const load = useCallback(
    (signal?: AbortSignal) =>
      getShipment(order.id)
        .then((data) => {
          if (!signal?.aborted) setShipment(data as Shipment);
        })
        .catch(() => {
          // No shipment yet is the ordinary answer for a new order, not an error.
          if (!signal?.aborted) setShipment(null);
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        }),
    [order.id],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  if (permission === "none") return null;

  const step = stepOf(order.status);
  const cancelled = order.status === "Cancelled";
  const couriers = state.couriers.filter((c) => c.enabled);
  const chosen = couriers.find((c) => c.id === courierId);

  const after = (label: string, fn: () => Promise<unknown>) =>
    run(label, async () => {
      await fn();
      await load();
      onChanged();
    });

  /** Why the primary action is unavailable, or "" when it is ready. */
  const blocker = !courierId ? "Choose how this order will be delivered first." : "";

  return (
    <Card className="px-5 py-5 sm:px-6">
      <div className="mb-4 flex items-center gap-2.5">
        <Truck className="h-5 w-5 text-zup-gray" strokeWidth={2} aria-hidden />
        <h3 className="text-ui-lg font-bold">Handling this order</h3>
        {shipment ? <Pill tone="blue">{shipment.status}</Pill> : null}
      </div>

      {cancelled ? (
        <p className="text-ui-sm text-zup-gray">
          This order is cancelled. Its stock has been released and nothing is being
          delivered.
        </p>
      ) : (
        <Stepper current={step} />
      )}

      {loading ? <p className="mt-4 text-ui-sm text-zup-gray">Loading…</p> : null}

      {/* ===== Step 1: confirm, and say how it ships ===== */}
      {!loading && !cancelled && !shipment ? (
        readOnly ? (
          <p className="mt-4 text-ui-sm text-zup-gray">
            Waiting to be confirmed and handed to a courier.
          </p>
        ) : (
          <div className="mt-5">
            <p className="mb-4 text-ui-sm text-zup-gray">
              Check the customer&apos;s details above, then say how this order is going
              out. Every order needs a courier — use <strong>Own delivery</strong> if your
              own rider is taking it.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="How is it being delivered?">
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
                <Field label="Which rider?">
                  <select
                    value={riderId}
                    onChange={(e) => setRiderId(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Decide later</option>
                    {state.staff.map((r) => (
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
                      placeholder="From the courier's slip"
                      className={`${inputCls} font-mono text-ui-sm`}
                    />
                  </Field>
                  <Field label="Tracking code">
                    <input
                      value={trackingCode}
                      onChange={(e) => setTrackingCode(e.target.value)}
                      placeholder="If they gave you one"
                      className={`${inputCls} font-mono text-ui-sm`}
                    />
                  </Field>
                </>
              ) : null}

              <Field label="Note for whoever carries it" className="sm:col-span-2">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. call before delivery"
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Handing a customer's details to a third party should be visible
                at the moment it happens, not buried in an adapter. */}
            {chosen?.kind === "api" ? (
              <div className="mt-4 rounded-xl bg-info-tint px-4 py-3 text-ui-sm">
                <p className="font-bold">{chosen.name} will be sent:</p>
                <p className="mt-1 text-zup-mid">
                  {order.customer} · {order.phone} · {order.address}
                </p>
                <p className="mt-1 text-zup-mid">
                  Collect at the door: <strong>{taka(order.total)}</strong>
                </p>
                <p className="mt-1.5 text-xs text-zup-gray">
                  Zero if the order was already paid online — worked out from the order,
                  not typed.
                </p>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <BtnPrimary
                disabled={!courierId || busy}
                onClick={() =>
                  after(
                    order.status === "Processing"
                      ? "Order confirmed and handed over"
                      : `Handed to ${chosen?.name ?? "courier"}`,
                    () =>
                      bookShipment(order.id, {
                        courierId,
                        confirm: true,
                        ...(riderId ? { riderId } : {}),
                        ...(consignmentId ? { consignmentId } : {}),
                        ...(trackingCode ? { trackingCode } : {}),
                        ...(note ? { note } : {}),
                      }),
                  )
                }
              >
                {order.status === "Processing"
                  ? "Confirm & hand to courier"
                  : "Hand to courier"}
              </BtnPrimary>

              {blocker ? (
                <span className="text-ui-sm text-zup-gray">{blocker}</span>
              ) : null}
            </div>
          </div>
        )
      ) : null}

      {/* ===== Steps 2–4: it is with someone ===== */}
      {shipment ? (
        <div className="mt-5">
          <dl className="grid gap-x-6 gap-y-2 text-ui-sm sm:grid-cols-2">
            <Row label="Carried by" value={shipment.courierName} />
            <Row label="Collect at door" value={taka(shipment.codAmount)} />
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

          {!readOnly && !cancelled ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {shipment.status === "Booked" ? (
                <BtnPrimary
                  disabled={busy}
                  onClick={() =>
                    after("Marked as picked up", () =>
                      patchShipment(shipment.id, { status: "Picked up" }),
                    )
                  }
                >
                  Mark picked up
                </BtnPrimary>
              ) : null}

              {shipment.status === "Picked up" || shipment.status === "In transit" ? (
                <BtnPrimary
                  disabled={busy}
                  onClick={() =>
                    after("Delivered — stock taken, warranty started", () =>
                      patchShipment(shipment.id, { status: "Delivered" }),
                    )
                  }
                >
                  Mark delivered
                </BtnPrimary>
              ) : null}

              {shipment.courierKind === "api" ? (
                <BtnGhost
                  disabled={busy}
                  className="min-h-10"
                  onClick={() => after("Asked the courier", () => syncShipment(shipment.id))}
                >
                  Sync with courier
                </BtnGhost>
              ) : null}

              {/* Corrections. Every status stays reachable, but out of the way
                  of the one action that is normally right. */}
              <Field label="Or set it directly" className="min-w-45">
                <select
                  value={shipment.status}
                  disabled={busy}
                  onChange={(e) =>
                    after("Delivery updated", () =>
                      patchShipment(shipment.id, {
                        status: e.target.value as ShipmentStatus,
                      }),
                    )
                  }
                  className={selectCls}
                >
                  {(
                    [
                      "Booked",
                      "Picked up",
                      "In transit",
                      "Delivered",
                      "Returned",
                      "Cancelled",
                    ] as ShipmentStatus[]
                  ).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}

          {shipment.status === "Delivered" ? (
            <p className="mt-3 text-xs text-zup-gray">
              Delivered — the order is closed, the stock is gone from inventory and
              warranty cover has started.
            </p>
          ) : null}

          {shipment.events.length > 0 ? (
            <ul className="mt-5 flex flex-col gap-2 border-t border-zup-body/8 pt-4">
              {shipment.events.map((e, i) => (
                <li key={i} className="text-ui-sm text-zup-gray">
                  <span className="font-semibold text-zup-body">{e.detail}</span> · {e.byName}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* Apart from the sequence, and styled as what it is. */}
      {!readOnly && !cancelled && order.status !== "Delivered" ? (
        <div className="mt-6 border-t border-zup-body/8 pt-4">
          <BtnDanger
            disabled={busy}
            onClick={() =>
              after("Order cancelled — stock released", () =>
                setOrderStatus(order.id, "Cancelled"),
              )
            }
          >
            Cancel this order
          </BtnDanger>
        </div>
      ) : null}
    </Card>
  );
}

/** Where the order stands, as four labelled stages. */
function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap gap-2">
      {STEPS.map((label, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li
            key={label}
            aria-current={now ? "step" : undefined}
            className={[
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-ui-sm font-semibold",
              done ? "bg-ok-bg text-ok-fg" : "",
              now ? "bg-zup-blue text-white" : "",
              !done && !now ? "bg-secondary text-zup-gray" : "",
            ].join(" ")}
          >
            {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
            {label}
          </li>
        );
      })}
    </ol>
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
