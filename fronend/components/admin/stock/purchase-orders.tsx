"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  useAdmin,
  taka,
  type PurchaseOrder,
} from "@/lib/admin";
import {
  Card,
  Table,
  Td,
  Pill,
  Field,
  BtnPrimary,
  BtnDanger,
  inputCls,
  selectCls,
} from "../ui";
import { ConfirmDialog } from "../confirm-dialog";
import { etaLabel } from "./stock-list";

/* ===== Purchase orders tab ===== */

export function PurchaseOrdersTab({
  readOnly,
  onReceive,
}: {
  readOnly: boolean;
  onReceive: (po: PurchaseOrder) => void;
}) {
  const { state, update } = useAdmin();
  const [creating, setCreating] = useState(false);
  const [productId, setProductId] = useState(state.products[0]?.id ?? "");
  const [supplierId, setSupplierId] = useState(state.suppliers[0]?.id ?? "");
  const [qty, setQty] = useState(10);

  const product = state.products.find((p) => p.id === productId);

  const create = () => {
    if (!product || !supplierId || qty < 1) {
      toast("Pick a product, supplier and quantity");
      return;
    }
    // value is computed server-side from cost × qty and appears on reload.
    const po: PurchaseOrder = {
      id: `PO-${2200 + state.purchaseOrders.length + 12}`,
      supplierId,
      productId,
      qty,
      value: 0,
      eta: etaLabel(),
      status: "Confirmed",
    };
    update({ purchaseOrders: [po, ...state.purchaseOrders] });
    setCreating(false);
    toast(`${po.id} created`);
  };

  return (
    <div className="flex flex-col gap-4">
      {!readOnly ? (
        <div className="flex justify-end">
          <BtnPrimary onClick={() => setCreating((c) => !c)}>
            <Plus className="h-4 w-4" strokeWidth={2.6} aria-hidden /> New purchase order
          </BtnPrimary>
        </div>
      ) : null}

      {creating ? (
        <Card className="px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr_auto]">
            <Field label="Product">
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className={selectCls}
              >
                {state.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Supplier">
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className={selectCls}
              >
                {state.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Qty">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.round(Number(e.target.value) || 1)))}
                className={inputCls}
              />
            </Field>
            <div className="flex items-end">
              <BtnPrimary onClick={create}>Create PO</BtnPrimary>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="px-2 py-2">
        <Table head={["PO", "Supplier", "Items", "Value", "ETA", "Status", ""]} minWidth={920}>
          {state.purchaseOrders.map((po) => {
            const product = state.products.find((p) => p.id === po.productId);
            const supplier = state.suppliers.find((s) => s.id === po.supplierId);
            const done = po.status === "Received" || po.status === "Cancelled";
            return (
              <tr key={po.id} className="last:[&>td]:border-0">
                <Td className="font-bold">{po.id}</Td>
                <Td className="text-zup-mid">{supplier?.name ?? "—"}</Td>
                <Td className="text-ui-sm text-zup-gray">
                  {product ? `${product.name} × ${po.qty}` : `Unknown item × ${po.qty}`}
                </Td>
                <Td className="whitespace-nowrap font-bold">{taka(po.value)}</Td>
                <Td className="whitespace-nowrap text-zup-gray">{po.eta}</Td>
                <Td>
                  <Pill
                    tone={
                      po.status === "Received"
                        ? "green"
                        : po.status === "Cancelled"
                          ? "gray"
                          : po.status === "In transit"
                            ? "purple"
                            : "blue"
                    }
                  >
                    {po.status}
                  </Pill>
                </Td>
                <Td className="text-right">
                  {!readOnly && !done ? (
                    <span className="flex justify-end gap-2">
                      <BtnPrimary
                        onClick={() => onReceive(po)}
                        className="min-h-8 px-4 text-ui-sm"
                      >
                        Receive
                      </BtnPrimary>
                      <ConfirmDialog
                        trigger={<BtnDanger>Cancel</BtnDanger>}
                        title={`Cancel purchase order ${po.id}?`}
                        description="The supplier won't be notified automatically — call them if goods are already in transit."
                        confirmLabel="Cancel order"
                        onConfirm={() => {
                          update({
                            purchaseOrders: state.purchaseOrders.map((x) =>
                              x.id === po.id ? { ...x, status: "Cancelled" } : x,
                            ),
                          });
                          toast(`${po.id} cancelled`);
                        }}
                      />
                    </span>
                  ) : null}
                </Td>
              </tr>
            );
          })}
          {state.purchaseOrders.length === 0 ? (
            <tr>
              <Td colSpan={7} className="py-10 text-center text-zup-soft">
                No purchase orders yet — create one, or hit Reorder on a low-stock row.
              </Td>
            </tr>
          ) : null}
        </Table>
      </Card>
      <p className="text-xs leading-relaxed text-zup-soft">
        Receiving a purchase order adds its quantity to on-hand stock and logs a movement.
      </p>
    </div>
  );
}
