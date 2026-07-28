"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAdmin, WARRANTY_STATUSES, type Warranty, type WarrantyStatus } from "@/lib/admin";
import { isExpired, isExpiringSoon, patchWarranty, useWarranties } from "@/lib/admin-warranty";
import { useFilterParams } from "./primitives/filter-params";
import {
  BtnGhost,
  Card,
  Pill,
  Segmented,
  Table,
  Td,
  inputCls,
  selectCls,
  warrantyStatusTone,
} from "./ui";

/*
 * Warranty registry. Rows are generated automatically when an order is
 * delivered (backend: lib/warranty.ts); this section is where staff record
 * serial numbers and work claims. Backfill for older orders lives on the
 * order's own screen ("Generate missing").
 */

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })} ${d.getFullYear()}`;
}

/*
 * Status and expiry are two independent questions about a warranty, and they
 * used to share one dropdown: ["All statuses", "Expiring soon", "Past expiry",
 * ...WARRANTY_STATUSES]. Picking "Expiring soon" therefore cleared the status
 * filter, so "which Active warranties are about to run out" — the single most
 * useful question here — could not be asked at all. They are two controls now.
 */
const EXPIRY_FILTERS = [
  { value: "any", label: "Any date" },
  { value: "soon", label: "Expiring soon" },
  { value: "past", label: "Past expiry" },
] as const;

export function WarrantySection() {
  const { can } = useAdmin();
  const readOnly = can("warranty") !== "manage";
  const { list, replace, loading, error, reload } = useWarranties();

  const { get, set, clear, active: filtersActive } = useFilterParams();
  const q = get("q");
  const statusFilter = get("status", "All statuses");
  const expiry = get("expiry", "any");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const savePatch = async (
    w: Warranty,
    patch: { serialNo?: string; status?: WarrantyStatus; claimNote?: string },
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      replace(await patchWarranty(w.id, patch));
      toast.success(`${w.id} updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the warranty");
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const rows = list.filter((w) => {
    const needle = q.trim().toLowerCase();
    const matchQ =
      !needle ||
      w.id.toLowerCase().includes(needle) ||
      w.orderId.toLowerCase().includes(needle) ||
      w.serialNo.toLowerCase().includes(needle) ||
      w.sku.toLowerCase().includes(needle) ||
      w.productName.toLowerCase().includes(needle) ||
      w.customer.toLowerCase().includes(needle) ||
      w.phone.replace(/\D/g, "").includes(needle.replace(/\D/g, "") || " ");
    const matchStatus = statusFilter === "All statuses" || w.status === statusFilter;
    const matchExpiry =
      expiry === "any" || (expiry === "soon" ? isExpiringSoon(w) : isExpired(w));
    return matchQ && matchStatus && matchExpiry;
  });

  const active = list.filter((w) => w.status === "Active").length;
  const claims = list.filter((w) => w.status === "Claimed").length;

  const head = ["Warranty", "Order", "Product", "Serial", "Cover", "Status", ""];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Search warranty, order, serial, SKU, product, customer or phone…"
          aria-label="Search warranty registry"
          className={`${inputCls} max-w-[460px] flex-1 rounded-full`}
        />
        <select
          value={statusFilter}
          onChange={(e) =>
            set({ status: e.target.value === "All statuses" ? null : e.target.value })
          }
          aria-label="Filter by status"
          className={selectCls}
        >
          {["All statuses", ...WARRANTY_STATUSES].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <Segmented
          label="Filter by expiry date"
          size="sm"
          options={EXPIRY_FILTERS}
          value={expiry as (typeof EXPIRY_FILTERS)[number]["value"]}
          onChange={(v) => set({ expiry: v === "any" ? null : v })}
        />
        {filtersActive ? <BtnGhost onClick={clear}>Reset filters</BtnGhost> : null}
      </div>

      <p className="text-ui-sm font-semibold text-zup-soft">
        {rows.length} of {list.length} records · {active} active
        {claims > 0 ? ` · ${claims} open claim${claims === 1 ? "" : "s"}` : ""}
      </p>

      {error ? (
        <Card className="px-5 py-8 text-center">
          <p className="text-ui-base font-semibold text-destructive">
            Could not load the warranty registry.
          </p>
          <div className="mt-3">
            <BtnGhost onClick={() => void reload()}>Try again</BtnGhost>
          </div>
        </Card>
      ) : (
        <Card className="px-2 py-2">
          <Table head={head} minWidth={1000}>
            {rows.map((w) => (
              <WarrantyRow
                key={w.id}
                warranty={w}
                readOnly={readOnly}
                busy={busy}
                expanded={expandedId === w.id}
                onToggle={() => setExpandedId((id) => (id === w.id ? null : w.id))}
                onPatch={(patch) => void savePatch(w, patch)}
              />
            ))}
            {rows.length === 0 ? (
              <tr>
                <Td colSpan={head.length} className="py-10 text-center text-zup-soft">
                  {loading
                    ? "Loading registry…"
                    : list.length === 0
                      ? "No warranty records yet — they are created when an order is delivered."
                      : "No records match your search."}
                </Td>
              </tr>
            ) : null}
          </Table>
        </Card>
      )}

      <p className="text-xs leading-relaxed text-zup-soft">
        Cover is generated from each product&apos;s warranty period when its order is marked
        Delivered. Set that period on the product (Products → edit → Warranty months).
      </p>
    </div>
  );
}

function WarrantyRow({
  warranty: w,
  readOnly,
  busy,
  expanded,
  onToggle,
  onPatch,
}: {
  warranty: Warranty;
  readOnly: boolean;
  busy: boolean;
  expanded: boolean;
  onToggle: () => void;
  onPatch: (patch: { serialNo?: string; status?: WarrantyStatus; claimNote?: string }) => void;
}) {
  const expiringSoon = isExpiringSoon(w);

  return (
    <>
      <tr className="last:[&>td]:border-0">
        <Td className="font-bold">{w.id}</Td>
        <Td className="text-zup-mid">{w.orderId}</Td>
        <Td className="text-zup-mid">
          {w.productName}
          <span className="block text-ui-xs text-zup-gray">
            {w.sku} · ×{w.qty}
          </span>
        </Td>
        <Td className="max-w-[180px] text-ui-xs leading-snug text-zup-gray">
          {w.serialNo || <span className="text-zup-faint">Not recorded</span>}
        </Td>
        <Td className="whitespace-nowrap text-ui-xs text-zup-gray">
          {shortDate(w.endsAt)}
          {expiringSoon ? (
            <span className="block text-ui-micro font-semibold text-warn-fg">
              Expiring soon
            </span>
          ) : null}
        </Td>
        <Td>
          {readOnly ? (
            <Pill tone={warrantyStatusTone(w.status)}>{w.status}</Pill>
          ) : (
            <select
              value={w.status}
              disabled={busy}
              aria-label={`Status of ${w.id}`}
              onChange={(e) => onPatch({ status: e.target.value as WarrantyStatus })}
              className={selectCls}
            >
              {WARRANTY_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
        </Td>
        <Td>
          <BtnGhost onClick={onToggle}>{expanded ? "Close" : "Details"}</BtnGhost>
        </Td>
      </tr>
      {expanded ? (
        <tr>
          <Td colSpan={7} className="bg-surface-sunken">
            <div className="grid gap-3 py-1 sm:grid-cols-2">
              <div>
                <p className="text-ui-micro font-bold uppercase tracking-[0.12em] text-zup-gray">
                  Customer
                </p>
                <p className="mt-1 text-ui-sm font-semibold">{w.customer}</p>
                <p className="text-ui-xs text-zup-gray">{w.phone}</p>
                <p className="mt-2 text-ui-xs text-zup-gray">
                  {w.months} months · {shortDate(w.startsAt)} → {shortDate(w.endsAt)}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-ui-micro font-bold uppercase tracking-[0.12em] text-zup-gray">
                    Serial number(s)
                  </span>
                  <input
                    defaultValue={w.serialNo}
                    disabled={readOnly || busy}
                    placeholder="Comma-separate multiple units"
                    onBlur={(e) => {
                      if (e.target.value !== w.serialNo) onPatch({ serialNo: e.target.value });
                    }}
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-ui-micro font-bold uppercase tracking-[0.12em] text-zup-gray">
                    Claim note
                  </span>
                  <textarea
                    defaultValue={w.claimNote}
                    disabled={readOnly || busy}
                    placeholder="What was reported, what was done"
                    onBlur={(e) => {
                      if (e.target.value !== w.claimNote) onPatch({ claimNote: e.target.value });
                    }}
                    className={`${inputCls} min-h-20 resize-y`}
                  />
                </label>
              </div>
            </div>
          </Td>
        </tr>
      ) : null}
    </>
  );
}
