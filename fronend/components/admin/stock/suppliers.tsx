"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  useAdmin,
  tempId,
} from "@/lib/admin";
import {
  Card,
  Table,
  Td,
  BtnPrimary,
  BtnDanger,
  inputCls,
} from "../ui";
import { ConfirmDialog } from "../confirm-dialog";

/* ===== Suppliers tab ===== */

export function SuppliersTab({ readOnly }: { readOnly: boolean }) {
  const { state, update } = useAdmin();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", contact: "", phone: "", items: "" });

  const add = () => {
    if (!draft.name.trim()) {
      toast("Supplier name is required");
      return;
    }
    update({
      suppliers: [
        ...state.suppliers,
        { id: tempId("supplier"), ...draft, name: draft.name.trim() },
      ],
    });
    setDraft({ name: "", contact: "", phone: "", items: "" });
    setAdding(false);
    toast(`${draft.name.trim()} added to suppliers`);
  };

  return (
    <div className="flex flex-col gap-4">
      {!readOnly ? (
        <div className="flex justify-end">
          <BtnPrimary onClick={() => setAdding((a) => !a)}>
            <Plus className="h-4 w-4" strokeWidth={2.6} aria-hidden /> Add supplier
          </BtnPrimary>
        </div>
      ) : null}

      {adding ? (
        <Card className="px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-[2fr_1.5fr_1.2fr_2fr_auto]">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Supplier name"
              aria-label="Supplier name"
              className={inputCls}
            />
            <input
              value={draft.contact}
              onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
              placeholder="Contact person"
              aria-label="Contact person"
              className={inputCls}
            />
            <input
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              placeholder="Phone"
              inputMode="tel"
              aria-label="Phone"
              className={inputCls}
            />
            <input
              value={draft.items}
              onChange={(e) => setDraft({ ...draft, items: e.target.value })}
              placeholder="What they supply"
              aria-label="What they supply"
              className={inputCls}
            />
            <BtnPrimary onClick={add}>Save</BtnPrimary>
          </div>
        </Card>
      ) : null}

      <Card className="px-2 py-2">
        <Table head={["Supplier", "Contact", "Phone", "Supplies", ""]} minWidth={760}>
          {state.suppliers.map((s) => {
            const hasOpenPo = state.purchaseOrders.some(
              (po) =>
                po.supplierId === s.id &&
                (po.status === "Confirmed" || po.status === "In transit"),
            );
            return (
              <tr key={s.id} className="last:[&>td]:border-0">
                <Td className="font-bold">{s.name}</Td>
                <Td className="text-zup-mid">{s.contact}</Td>
                <Td className="whitespace-nowrap text-zup-gray">{s.phone}</Td>
                <Td className="text-zup-gray">{s.items}</Td>
                <Td className="text-right">
                  {!readOnly ? (
                    <ConfirmDialog
                      trigger={
                        <BtnDanger
                          disabled={hasOpenPo}
                          title={hasOpenPo ? "Has open purchase orders" : undefined}
                        >
                          Remove
                        </BtnDanger>
                      }
                      title={`Remove supplier "${s.name}"?`}
                      description="This can't be undone."
                      confirmLabel="Remove"
                      onConfirm={() => {
                        update({ suppliers: state.suppliers.filter((x) => x.id !== s.id) });
                        toast(`${s.name} removed`);
                      }}
                    />
                  ) : null}
                </Td>
              </tr>
            );
          })}
          {state.suppliers.length === 0 ? (
            <tr>
              <Td colSpan={5} className="py-10 text-center text-zup-soft">
                No suppliers yet — add one to start creating purchase orders.
              </Td>
            </tr>
          ) : null}
        </Table>
      </Card>
    </div>
  );
}
