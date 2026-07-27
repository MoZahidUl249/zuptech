"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  useAdmin,
  taka,
  ORDER_STATUSES,
  INVOICE_STATUSES,
  WARRANTY_STATUSES,
  type InvoiceStatus,
  type OrderDetail,
  type OrderEvent,
  type OrderStatus,
  type SiteContact,
  type WarrantyStatus,
} from "@/lib/admin";
import { getOrderDetail } from "@/lib/admin-api";
import { createInvoice, patchInvoice } from "@/lib/admin-invoices";
import { generateWarranties, patchWarranty } from "@/lib/admin-warranty";
import { cn } from "@/lib/utils";
import {
  BtnGhost,
  BtnPrimary,
  Card,
  Pill,
  Table,
  Td,
  inputCls,
  invoiceStatusTone,
  orderStatusTone,
  selectCls,
  warrantyStatusTone,
} from "./ui";
import { InvoiceDocument } from "./invoice-document";

const UNASSIGNED = "__unassigned__";

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })} ${d.getFullYear()}`;
}

function shortDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })}, ${String(
    d.getHours(),
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ===== List ===== */

export function OrdersSection() {
  const { state, update, can } = useAdmin();
  const readOnly = can("orders") !== "manage";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [ownerFilter, setOwnerFilter] = useState("All staff");
  const [totalMin, setTotalMin] = useState("");
  const [totalMax, setTotalMax] = useState("");

  // The detail view owns its own fetch, so the list stays a pure projection of
  // AdminState and nothing here needs to know about events or invoices.
  if (selectedId) {
    return <OrderDetailView orderId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  const rows = state.orders.filter((o) => {
    const needle = q.trim().toLowerCase();
    const matchQ =
      !needle ||
      o.id.toLowerCase().includes(needle) ||
      o.customer.toLowerCase().includes(needle) ||
      o.address.toLowerCase().includes(needle) ||
      (o.preparedBy ?? "").toLowerCase().includes(needle) ||
      o.phone.replace(/\D/g, "").includes(needle.replace(/\D/g, "") || " ");
    const matchStatus = statusFilter === "All statuses" || o.status === statusFilter;
    const matchOwner =
      ownerFilter === "All staff" ||
      (ownerFilter === UNASSIGNED ? o.preparedById === null : o.preparedById === ownerFilter);
    const matchTotalMin = totalMin === "" || o.total >= Number(totalMin);
    const matchTotalMax = totalMax === "" || o.total <= Number(totalMax);
    return matchQ && matchStatus && matchOwner && matchTotalMin && matchTotalMax;
  });

  const filtersActive =
    q.trim() !== "" ||
    statusFilter !== "All statuses" ||
    ownerFilter !== "All staff" ||
    totalMin !== "" ||
    totalMax !== "";

  const resetFilters = () => {
    setQ("");
    setStatusFilter("All statuses");
    setOwnerFilter("All staff");
    setTotalMin("");
    setTotalMax("");
  };

  const unclaimed = state.orders.filter((o) => o.preparedById === null).length;

  const head = ["Order", "Placed", "Customer", "Prepared by", "Total", "Invoice", "Status", ""];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search order, customer, phone, address or preparer…"
          aria-label="Search orders"
          className={`${inputCls} max-w-[420px] flex-1 rounded-full`}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className={selectCls}
        >
          {["All statuses", ...ORDER_STATUSES].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          aria-label="Filter by who prepared the order"
          className={selectCls}
        >
          <option value="All staff">All staff</option>
          <option value={UNASSIGNED}>Unassigned{unclaimed ? ` (${unclaimed})` : ""}</option>
          {state.staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="numeric"
            value={totalMin}
            onChange={(e) => setTotalMin(e.target.value)}
            placeholder="Min total"
            aria-label="Minimum total"
            className={`${inputCls} w-24`}
          />
          <span className="text-zup-faint">-</span>
          <input
            type="number"
            inputMode="numeric"
            value={totalMax}
            onChange={(e) => setTotalMax(e.target.value)}
            placeholder="Max total"
            aria-label="Maximum total"
            className={`${inputCls} w-24`}
          />
        </div>
        {filtersActive ? <BtnGhost onClick={resetFilters}>Reset filters</BtnGhost> : null}
      </div>

      <p className="text-[13px] font-semibold text-zup-soft">
        {rows.length} of {state.orders.length} orders
        {unclaimed > 0 ? ` · ${unclaimed} not yet claimed` : ""}
      </p>

      <Card className="px-2 py-2">
        <Table head={head} minWidth={1040}>
          {rows.map((o) => (
            <tr key={o.id} className="last:[&>td]:border-0">
              <Td className="font-bold">{o.id}</Td>
              <Td className="whitespace-nowrap text-[13px] text-zup-gray">
                {shortDate(o.createdAt)}
              </Td>
              <Td className="text-zup-mid">
                {o.customer}
                <span className="block text-[12px] text-zup-gray">{o.phone}</span>
              </Td>
              <Td className="whitespace-nowrap text-[13px]">
                {o.preparedBy ? (
                  <span className="font-semibold text-zup-mid">{o.preparedBy}</span>
                ) : (
                  <span className="text-zup-faint">Unassigned</span>
                )}
              </Td>
              <Td className="whitespace-nowrap font-bold">{taka(o.total)}</Td>
              <Td className="whitespace-nowrap text-[13px]">
                {o.invoiceId ? (
                  <>
                    <span className="text-zup-mid">{o.invoiceId}</span>
                    <Pill
                      tone={invoiceStatusTone(o.invoiceStatus ?? "")}
                      className="ml-1.5 px-2 py-0.5 text-[10.5px]"
                    >
                      {o.invoiceStatus}
                    </Pill>
                  </>
                ) : (
                  <span className="text-zup-faint">—</span>
                )}
              </Td>
              <Td>
                {readOnly ? (
                  <Pill tone={orderStatusTone(o.status)}>{o.status}</Pill>
                ) : (
                  <select
                    value={o.status}
                    aria-label={`Status of ${o.id}`}
                    onChange={(e) => {
                      update({
                        orders: state.orders.map((x) =>
                          x.id === o.id ? { ...x, status: e.target.value as OrderStatus } : x,
                        ),
                      });
                      toast(`${o.id} → ${e.target.value}`);
                    }}
                    className={selectCls}
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                )}
              </Td>
              <Td>
                <BtnGhost onClick={() => setSelectedId(o.id)}>Open</BtnGhost>
              </Td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <Td colSpan={head.length} className="py-10 text-center text-zup-soft">
                No orders match your search.
              </Td>
            </tr>
          ) : null}
        </Table>
      </Card>
    </div>
  );
}

/* ===== Detail ===== */

function OrderDetailView({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const { state, user, can } = useAdmin();
  const readOnly = can("orders") !== "manage";
  const canInvoice = can("invoices");
  const canWarranty = can("warranty");

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    (signal?: AbortSignal) =>
      getOrderDetail(orderId)
        .then((data) => {
          if (signal?.aborted) return;
          setOrder(data);
          setError("");
        })
        .catch((err: Error) => {
          if (!signal?.aborted) setError(err.message);
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

  /** Run a mutation, surface its error, and refresh from the server. */
  const run = async (label: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await load();
      toast.success(label);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const patchOrder = (body: { status?: OrderStatus; preparedById?: string | null }) =>
    fetch(`/admin/api/orders/${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async (res) => {
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Update failed (${res.status})`);
      }
    });

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <BtnGhost onClick={onBack}>← Back to orders</BtnGhost>
        <Card className="px-5 py-10 text-center text-[13px] text-zup-soft">Loading order…</Card>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col gap-4">
        <BtnGhost onClick={onBack}>← Back to orders</BtnGhost>
        <Card className="px-5 py-10 text-center">
          <p className="text-[14px] font-semibold text-[#D32F2F]">
            {error || "Order not found"}
          </p>
          <div className="mt-4">
            <BtnGhost onClick={() => void load()}>Try again</BtnGhost>
          </div>
        </Card>
      </div>
    );
  }

  const goodsTotal = order.items.reduce((sum, i) => sum + i.lineTotal, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-secondary px-3.5 text-[13px] font-bold text-zup-mid transition-colors hover:bg-zup-body/10"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to orders
        </button>
        <h2 className="text-[18px] font-extrabold tracking-[-0.015em]">{order.id}</h2>
        <Pill tone={orderStatusTone(order.status)}>{order.status}</Pill>
        <span className="text-[12.5px] text-zup-soft">{shortDateTime(order.createdAt)}</span>
      </div>

      <div className="no-print grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {/* Customer + lines */}
          <Card className="px-5 py-5 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-zup-gray">
                  Customer
                </p>
                <p className="mt-1.5 text-[14.5px] font-bold">{order.customer}</p>
                <p className="text-[13px] text-zup-mid">{order.phone}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-zup-gray">{order.address}</p>
              </div>
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-zup-gray">
                  Payment
                </p>
                <p className="mt-1.5 text-[14px] font-semibold">{order.pay}</p>
                <p className="mt-1 text-[13px] text-zup-gray">
                  {order.insideDhaka ? "Inside Dhaka" : "Outside Dhaka"}
                </p>
              </div>
            </div>

            <div className="mt-5 -mx-2">
              <Table head={["Item", "SKU", "Qty", "Unit price", "Amount"]} minWidth={560}>
                {order.items.map((item) => (
                  <tr key={item.productId} className="last:[&>td]:border-0">
                    <Td className="font-semibold">{item.name}</Td>
                    <Td className="text-[12.5px] text-zup-gray">{item.sku}</Td>
                    <Td>{item.qty}</Td>
                    <Td>{taka(item.unitPrice)}</Td>
                    <Td className="font-bold">{taka(item.lineTotal)}</Td>
                  </tr>
                ))}
              </Table>
            </div>

            <div className="mt-4 flex justify-end">
              <div className="flex w-full max-w-[240px] flex-col gap-1.5 text-[13px]">
                <div className="flex justify-between text-zup-gray">
                  <span>Goods</span>
                  <span>{taka(goodsTotal)}</span>
                </div>
                <div className="flex justify-between text-zup-gray">
                  <span>Delivery</span>
                  <span>{taka(order.deliveryFee)}</span>
                </div>
                <div className="flex justify-between text-zup-gray">
                  <span>Installation</span>
                  <span>{taka(order.installationFee)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-zup-body/10 pt-2 text-[15px] font-extrabold">
                  <span>Total</span>
                  <span>{taka(order.total)}</span>
                </div>
              </div>
            </div>
          </Card>

          <InvoiceCard
            order={order}
            contact={state.contact}
            permission={canInvoice}
            busy={busy}
            onCreate={() => run("Invoice created", () => createInvoice(order.id))}
            onStatus={(status) =>
              run(`Invoice ${status.toLowerCase()}`, () =>
                patchInvoice(order.invoice!.id, { status }),
              )
            }
          />

          <WarrantyCard
            order={order}
            permission={canWarranty}
            busy={busy}
            onGenerate={() =>
              run("Warranty records generated", () => generateWarranties(order.id))
            }
            onPatch={(id, patch) => run("Warranty updated", () => patchWarranty(id, patch))}
          />
        </div>

        {/* Accountability sidebar */}
        <div className="flex flex-col gap-4">
          <Card className="px-5 py-5">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-zup-gray">
              Prepared by
            </p>
            <p className="mt-2 text-[15px] font-bold">
              {order.preparedBy ?? <span className="text-zup-faint">Unassigned</span>}
            </p>
            {readOnly ? null : (
              <div className="mt-3 flex flex-col gap-2">
                <select
                  value={order.preparedById ?? ""}
                  disabled={busy}
                  aria-label="Assign who prepared this order"
                  onChange={(e) =>
                    void run("Prepared by updated", () =>
                      patchOrder({ preparedById: e.target.value || null }),
                    )
                  }
                  className={`${selectCls} w-full`}
                >
                  <option value="">Unassigned</option>
                  {state.staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {user && order.preparedById !== user.id ? (
                  <BtnPrimary
                    disabled={busy}
                    onClick={() =>
                      void run("You are now the preparer", () =>
                        patchOrder({ preparedById: user.id }),
                      )
                    }
                  >
                    Claim this order
                  </BtnPrimary>
                ) : null}
              </div>
            )}
          </Card>

          <Card className="px-5 py-5">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-zup-gray">
              Timeline
            </p>
            {order.events.length === 0 ? (
              <p className="mt-3 text-[13px] text-zup-soft">No activity recorded yet.</p>
            ) : (
              <ol className="mt-3 flex flex-col gap-3.5">
                {order.events.map((e) => (
                  <TimelineEntry key={e.id} event={e} />
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

    </div>
  );
}

const EVENT_DOTS: Record<string, string> = {
  placed: "bg-zup-blue",
  status: "bg-zup-green",
  "prepared-by": "bg-zup-orange",
  invoice: "bg-[#6B46C1]",
  warranty: "bg-[#B7791F]",
  note: "bg-zup-soft",
};

function TimelineEntry({ event }: { event: OrderEvent }) {
  return (
    <li className="flex gap-2.5">
      <span
        aria-hidden
        className={cn(
          "mt-1.5 h-2 w-2 flex-none rounded-full",
          EVENT_DOTS[event.kind] ?? "bg-zup-soft",
        )}
      />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold leading-snug text-zup-body">{event.detail}</p>
        <p className="text-[11.5px] text-zup-soft">
          {shortDateTime(event.at)} · {event.byName}
        </p>
      </div>
    </li>
  );
}

/* ===== Invoice + warranty cards (order detail) ===== */

function InvoiceCard({
  order,
  contact,
  permission,
  busy,
  onCreate,
  onStatus,
}: {
  order: OrderDetail;
  contact: SiteContact;
  permission: "none" | "view" | "manage";
  busy: boolean;
  onCreate: () => void;
  onStatus: (status: InvoiceStatus) => void;
}) {
  const [preview, setPreview] = useState(false);
  if (permission === "none") return null;

  const invoice = order.invoice;

  return (
    <Card className="px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <p className="text-[15px] font-bold">Invoice</p>
        {invoice ? (
          <>
            <span className="text-[13px] font-semibold text-zup-mid">{invoice.id}</span>
            <Pill tone={invoiceStatusTone(invoice.status)}>{invoice.status}</Pill>
          </>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {invoice ? (
            <>
              <BtnGhost onClick={() => setPreview((v) => !v)}>
                {preview ? "Hide" : "Preview"}
              </BtnGhost>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full bg-secondary px-3.5 text-[13px] font-bold text-zup-mid transition-colors hover:bg-zup-body/10"
              >
                <Printer className="h-3.5 w-3.5" aria-hidden />
                Print
              </button>
              {permission === "manage" ? (
                <select
                  value={invoice.status}
                  disabled={busy}
                  aria-label="Invoice status"
                  onChange={(e) => onStatus(e.target.value as InvoiceStatus)}
                  className={selectCls}
                >
                  {INVOICE_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              ) : null}
            </>
          ) : permission === "manage" ? (
            <BtnPrimary disabled={busy} onClick={onCreate}>
              Create invoice
            </BtnPrimary>
          ) : null}
        </div>
      </div>

      {invoice ? (
        <p className="mt-2 text-[12.5px] text-zup-gray">
          Raised {shortDate(invoice.createdAt)}
          {invoice.issuedAt ? ` · issued ${shortDate(invoice.issuedAt)}` : ""}
          {invoice.paidAt ? ` · paid ${shortDate(invoice.paidAt)}` : ""}
          {invoice.issuedBy ? ` · by ${invoice.issuedBy}` : ""}
        </p>
      ) : (
        <p className="mt-2 text-[12.5px] text-zup-gray">
          No invoice raised for this order yet.
        </p>
      )}

      {/* Exactly one copy of the document exists at a time: on screen when
          previewing, otherwise print-only. Two would both claim `inset-0`
          under the print rules and overlap. */}
      {invoice ? (
        <div className={preview ? "mt-4" : "hidden print:block"}>
          <InvoiceDocument invoice={invoice} contact={contact} />
        </div>
      ) : null}
    </Card>
  );
}

function WarrantyCard({
  order,
  permission,
  busy,
  onGenerate,
  onPatch,
}: {
  order: OrderDetail;
  permission: "none" | "view" | "manage";
  busy: boolean;
  onGenerate: () => void;
  onPatch: (
    id: string,
    patch: { serialNo?: string; status?: WarrantyStatus; claimNote?: string },
  ) => void;
}) {
  if (permission === "none") return null;

  const editable = permission === "manage";
  const delivered = order.status === "Delivered";

  return (
    <Card className="px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <p className="text-[15px] font-bold">Warranty</p>
        <span className="text-[12.5px] text-zup-soft">
          {order.warranties.length} record{order.warranties.length === 1 ? "" : "s"}
        </span>
        {editable && delivered ? (
          <div className="ml-auto">
            <BtnGhost disabled={busy} onClick={onGenerate}>
              Generate missing
            </BtnGhost>
          </div>
        ) : null}
      </div>

      {order.warranties.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-zup-gray">
          {delivered
            ? "No warranty records — none of these products has a warranty period set."
            : "Warranty cover starts at delivery, so nothing is registered yet."}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-zup-body/6">
          {order.warranties.map((w) => (
            <li key={w.id} className="py-3.5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-bold">{w.id}</span>
                <span className="text-[13px] text-zup-mid">{w.productName}</span>
                <span className="text-[12px] text-zup-gray">×{w.qty}</span>
                <Pill tone={warrantyStatusTone(w.status)} className="ml-auto">
                  {w.status}
                </Pill>
              </div>
              <p className="mt-1 text-[12px] text-zup-gray">
                {w.months} months · {shortDate(w.startsAt)} → {shortDate(w.endsAt)}
              </p>
              {editable ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <input
                    defaultValue={w.serialNo}
                    placeholder="Serial number(s)"
                    aria-label={`Serial numbers for ${w.id}`}
                    disabled={busy}
                    onBlur={(e) => {
                      if (e.target.value !== w.serialNo) {
                        onPatch(w.id, { serialNo: e.target.value });
                      }
                    }}
                    className={`${inputCls} max-w-[260px] flex-1`}
                  />
                  <select
                    value={w.status}
                    disabled={busy}
                    aria-label={`Status of ${w.id}`}
                    onChange={(e) => onPatch(w.id, { status: e.target.value as WarrantyStatus })}
                    className={selectCls}
                  >
                    {WARRANTY_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              ) : w.serialNo ? (
                <p className="mt-1 text-[12px] text-zup-mid">Serial: {w.serialNo}</p>
              ) : null}
              {w.claimNote ? (
                <p className="mt-1.5 text-[12px] leading-relaxed text-zup-gray">{w.claimNote}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
