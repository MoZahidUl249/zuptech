"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn, numberInput } from "@/lib/utils";
import {
  isUnsaved,
  useAdmin,
  taka,
  bd,
  tempId,
  type AdminProduct,
  type PurchaseOrder,
  type Supplier,
} from "@/lib/admin";
import {
  Card,
  KpiCard,
  Table,
  Td,
  Pill,
  Segmented,
  BtnPrimary,
  BtnGhost,
  inputCls,
  selectCls,
} from "../ui";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Field } from "../ui";
import { useFilterParams } from "../primitives/filter-params";
import { PurchaseOrdersTab } from "./purchase-orders";
import { SuppliersTab } from "./suppliers";

/* ===== Inventory ===== */

type InvTab = "stock" | "po" | "movements" | "suppliers";

export function nowLabel(): string {
  const d = new Date();
  const month = d.toLocaleString("en", { month: "short" });
  return `${d.getDate()} ${month}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function etaLabel(daysAhead = 7): string {
  const d = new Date(Date.now() + daysAhead * 86400000);
  return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })} ${d.getFullYear()}`;
}

export function InventorySection() {
  const { state, update, can, user } = useAdmin();
  const readOnly = can("inventory") !== "manage";
  // Tab and filter live in the URL so Today can link straight to
  // "?filter=low" or "?tab=po" and land on the right thing.
  const { get, set } = useFilterParams();
  const tab = (get("tab", "stock") || "stock") as InvTab;
  const setTab = (v: InvTab) => set({ tab: v === "stock" ? null : v });
  const q = get("q");
  const setQ = (v: string) => set({ q: v });
  const FILTERS: Record<string, string> = { low: "Low stock", out: "Out of stock" };
  const filter = FILTERS[get("filter")] ?? "All stock";
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [draftStock, setDraftStock] = useState(0);

  const me = user?.username ?? "you";
  const totalValue = state.products.reduce((a, p) => a + p.cost * p.stock, 0);
  const low = state.products.filter((p) => p.stock > 0 && p.stock <= p.reorderAt);
  const out = state.products.filter((p) => p.stock === 0);
  const openPos = state.purchaseOrders.filter(
    (po) => po.status === "Confirmed" || po.status === "In transit",
  );

  const rows = state.products.filter((p) => {
    const needle = q.trim().toLowerCase();
    const matchQ =
      !needle ||
      p.name.toLowerCase().includes(needle) ||
      p.sku.toLowerCase().includes(needle);
    const matchF =
      filter === "All stock" ||
      (filter === "Low stock"
        ? p.stock > 0 && p.stock <= p.reorderAt
        : filter === "Out of stock"
          ? p.stock === 0
          : true);
    return matchQ && matchF;
  });

  const logMovement = (sku: string, change: number, reason: string) => ({
    id: `m${Date.now()}${Math.floor(Math.random() * 1e4)}`,
    date: nowLabel(),
    sku,
    change,
    reason,
    by: me,
  });

  const saveAdjust = () => {
    const p = state.products.find((x) => x.id === adjustingId);
    if (!p) return;
    const diff = draftStock - p.stock;
    update({
      products: state.products.map((x) =>
        x.id === p.id ? { ...x, stock: draftStock } : x,
      ),
      movements:
        diff !== 0
          ? [logMovement(p.sku, diff, "Manual stock adjustment"), ...state.movements]
          : state.movements,
    });
    setAdjustingId(null);
    toast(`${p.sku} on-hand set to ${draftStock}`);
  };

  // "Reorder" used to raise a purchase order against `state.suppliers[0]`
  // without saying so — whichever supplier happened to be first in the list,
  // with no way to notice until the wrong one delivered. It now opens a
  // dialog with the supplier and quantity both visible and editable.
  const [reorderFor, setReorderFor] = useState<AdminProduct | null>(null);

  const placeReorder = (p: AdminProduct, supplierId: string, qty: number) => {
    const supplier = state.suppliers.find((s) => s.id === supplierId);
    if (!supplier) return;
    // `value` is computed by the backend (cost × qty) — the row refreshes with
    // the server's figure right after the PO is created, and the id is the
    // server's too rather than a guessed "PO-2214".
    const po: PurchaseOrder = {
      id: tempId("po"),
      supplierId,
      productId: p.id,
      qty,
      value: 0,
      eta: etaLabel(),
      status: "Confirmed",
    };
    update({ purchaseOrders: [po, ...state.purchaseOrders] });
    setReorderFor(null);
    toast(`Ordered ${qty} × ${p.name} from ${supplier.name}`);
  };

  /** What we'd suggest ordering: top back up to twice the reorder point. */
  const suggestedQty = (p: AdminProduct) =>
    Math.max(p.reorderAt * 2 - p.stock, p.reorderAt, 1);

  /**
   * Mark a PO received.
   *
   * Only the PO status is staged. The stock increment is deliberately NOT
   * applied locally: the server does it inside `POST /purchase-orders/:id/receive`
   * (`inventory.ts`, `stock: { increment: qty }`) and logs the movement itself.
   * Staging the delta too meant syncKeys ran its `products` branch first and
   * sent an *absolute* adjustStock(old + qty), then the receive incremented
   * again — landing at old + 2×qty, with two movement rows. It only looked
   * right because the refetch immediately overwrote the wrong number.
   */
  const receivePo = (po: PurchaseOrder) => {
    const p = state.products.find((x) => x.id === po.productId);
    update({
      purchaseOrders: state.purchaseOrders.map((x) =>
        x.id === po.id ? { ...x, status: "Received" } : x,
      ),
    });
    toast(
      p
        ? `${po.id} marked received — save to add ${po.qty} to ${p.sku}`
        : `${po.id} marked received — press Save to apply it`,
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <KpiCard
          label="Total SKUs"
          value={String(state.products.length)}
          note={`${state.products.filter((p) => p.visible).length} live on store`}
        />
        <KpiCard
          label="Stock value (cost)"
          value={taka(totalValue)}
          note={`${bd(state.products.reduce((a, p) => a + p.stock, 0))} units on hand`}
        />
        <KpiCard
          label="Low stock"
          value={String(low.length)}
          note={low.length ? "reorder soon" : "all healthy"}
          tone="amber"
        />
        <KpiCard
          label="Open purchase orders"
          value={String(openPos.length)}
          note={out.length ? `${out.length} SKU out of stock` : "incoming stock"}
          tone={out.length ? "red" : "muted"}
        />
      </div>

      <Segmented
        options={[
          { value: "stock", label: "Stock" },
          { value: "po", label: "Purchase orders" },
          { value: "movements", label: "Movements" },
          { value: "suppliers", label: "Suppliers" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "stock" ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search product or SKU…"
              aria-label="Search inventory"
              className={`${inputCls} max-w-[460px] flex-1 rounded-full`}
            />
            <select
              value={filter}
              onChange={(e) =>
                set({
                  filter:
                    e.target.value === "Low stock"
                      ? "low"
                      : e.target.value === "Out of stock"
                        ? "out"
                        : null,
                })
              }
              aria-label="Filter stock"
              className={selectCls}
            >
              {["All stock", "Low stock", "Out of stock"].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>

          <Card className="px-2 py-2">
            <Table
              head={["SKU", "Product", "On hand", "Reserved", "Available", "Reorder at", "Stock value", ""]}
              minWidth={940}
            >
              {rows.map((p) => {
                const lowP = p.stock > 0 && p.stock <= p.reorderAt;
                const outP = p.stock === 0;
                const adjusting = adjustingId === p.id;
                const hasOpenPo = openPos.some((po) => po.productId === p.id);
                return (
                  <tr key={p.id} className={cn("last:[&>td]:border-0", adjusting && "bg-info-tint")}>
                    <Td className="font-mono text-ui-sm text-zup-gray">{p.sku}</Td>
                    <Td className="font-bold">
                      {p.name}
                      {lowP ? (
                        <Pill tone="amber" className="ml-2 px-2 py-0.5 text-ui-micro">
                          LOW
                        </Pill>
                      ) : null}
                      {outP ? (
                        <Pill tone="red" className="ml-2 px-2 py-0.5 text-ui-micro">
                          OUT
                        </Pill>
                      ) : null}
                      {hasOpenPo ? (
                        <Pill tone="blue" className="ml-2 px-2 py-0.5 text-ui-micro">
                          PO OPEN
                        </Pill>
                      ) : null}
                    </Td>
                    <Td
                      className={cn(
                        "font-bold",
                        outP ? "text-destructive" : lowP ? "text-warn-fg" : undefined,
                      )}
                    >
                      {adjusting ? (
                        <span className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Decrease stock"
                            onClick={() => setDraftStock((s) => Math.max(0, s - 1))}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-base font-bold text-zup-mid shadow-sm transition-colors hover:bg-secondary"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={draftStock}
                            autoFocus
                            aria-label={`On-hand stock for ${p.name}`}
                            onChange={(e) =>
                              setDraftStock(Math.max(0, Math.round(Number(e.target.value) || 0)))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveAdjust();
                              if (e.key === "Escape") setAdjustingId(null);
                            }}
                            className="h-8 w-14 rounded-lg border border-zup-blue bg-white px-1 text-center text-sm font-bold outline-none"
                          />
                          <button
                            type="button"
                            aria-label="Increase stock"
                            onClick={() => setDraftStock((s) => s + 1)}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-base font-bold text-zup-mid shadow-sm transition-colors hover:bg-secondary"
                          >
                            +
                          </button>
                        </span>
                      ) : (
                        p.stock
                      )}
                    </Td>
                    <Td className="text-zup-gray">{p.reserved}</Td>
                    <Td className="font-bold">{Math.max(p.stock - p.reserved, 0)}</Td>
                    <Td className="text-zup-gray">{p.reorderAt}</Td>
                    <Td className="whitespace-nowrap">৳ {bd(p.cost * p.stock)}</Td>
                    <Td className="text-right">
                      {!readOnly ? (
                        adjusting ? (
                          <span className="flex justify-end gap-2">
                            <BtnPrimary onClick={saveAdjust} className="min-h-8 px-4 text-ui-sm">
                              Save
                            </BtnPrimary>
                            <BtnGhost onClick={() => setAdjustingId(null)}>Cancel</BtnGhost>
                          </span>
                        ) : (
                          <span className="flex justify-end gap-2">
                            {(lowP || outP) && !hasOpenPo ? (
                              <BtnPrimary
                                onClick={() => setReorderFor(p)}
                                className="min-h-8 px-4 text-ui-sm"
                              >
                                Reorder
                              </BtnPrimary>
                            ) : null}
                            <BtnGhost
                              onClick={() => {
                                setAdjustingId(p.id);
                                setDraftStock(p.stock);
                              }}
                            >
                              Adjust
                            </BtnGhost>
                          </span>
                        )
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </Table>
          </Card>
        </>
      ) : null}

      {tab === "po" ? (
        <PurchaseOrdersTab readOnly={readOnly} onReceive={receivePo} />
      ) : null}

      {tab === "movements" ? (
        <Card className="px-2 py-2">
          <Table head={["When", "SKU", "Change", "Reason", "By"]} minWidth={720}>
            {state.movements.map((m) => (
              <tr key={m.id} className="last:[&>td]:border-0">
                <Td className="whitespace-nowrap text-zup-gray">{m.date}</Td>
                <Td className="font-mono text-ui-sm text-zup-gray">{m.sku}</Td>
                <Td
                  className={cn(
                    "font-bold",
                    m.change > 0 ? "text-zup-green" : "text-destructive",
                  )}
                >
                  {m.change > 0 ? `+${m.change}` : m.change}
                </Td>
                <Td className="text-zup-mid">{m.reason}</Td>
                <Td className="text-zup-gray">{m.by}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : null}

      {tab === "suppliers" ? <SuppliersTab readOnly={readOnly} /> : null}

      {reorderFor ? (
        <ReorderDialog
          product={reorderFor}
          suppliers={state.suppliers.filter((s) => !isUnsaved(s))}
          suggestedQty={suggestedQty(reorderFor)}
          onCancel={() => setReorderFor(null)}
          onConfirm={(supplierId, qty) => placeReorder(reorderFor, supplierId, qty)}
        />
      ) : null}
    </div>
  );
}

/** Confirm what's being ordered, from whom, before raising a purchase order. */
function ReorderDialog({
  product,
  suppliers,
  suggestedQty,
  onCancel,
  onConfirm,
}: {
  product: AdminProduct;
  suppliers: Supplier[];
  suggestedQty: number;
  onCancel: () => void;
  onConfirm: (supplierId: string, qty: number) => void;
}) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [qty, setQty] = useState(suggestedQty);

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-[420px]">
        <DialogTitle className="text-ui-lg font-bold">Order more stock</DialogTitle>
        <p className="text-ui-sm text-zup-gray">
          {product.name} — {product.stock} left, you asked to be warned at{" "}
          {product.reorderAt}.
        </p>

        {suppliers.length === 0 ? (
          <p className="rounded-xl bg-warn-bg px-3.5 py-3 text-ui-sm text-warn-fg">
            Add a supplier on the Suppliers tab first — an order has to be placed with
            someone.
          </p>
        ) : (
          <div className="flex flex-col gap-3.5">
            <Field label="Order from">
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className={selectCls}
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="How many">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={qty}
                onChange={(e) => setQty(numberInput(e.target.value, { min: 1 }))}
                className={inputCls}
              />
            </Field>
            <p className="text-ui-sm text-zup-soft">
              We suggest {suggestedQty} — enough to get back above your warning level.
            </p>
          </div>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <BtnGhost onClick={onCancel}>Cancel</BtnGhost>
          <BtnPrimary
            disabled={!supplierId || qty < 1}
            onClick={() => onConfirm(supplierId, qty)}
          >
            Place the order
          </BtnPrimary>
        </div>
      </DialogContent>
    </Dialog>
  );
}
