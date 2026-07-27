"use client";

import { useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  useAdmin,
  taka,
  INVOICE_STATUSES,
  type Invoice,
  type InvoiceStatus,
} from "@/lib/admin";
import { patchInvoice, useInvoices } from "@/lib/admin-invoices";
import {
  BtnGhost,
  Card,
  Pill,
  Table,
  Td,
  inputCls,
  invoiceStatusTone,
  selectCls,
} from "./ui";
import { InvoiceDocument } from "./invoice-document";

/*
 * Invoice register. Invoices are raised from an order (Orders → open an order →
 * Create invoice); this section is the cross-order view for finding, issuing,
 * marking paid and printing them.
 */

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })} ${d.getFullYear()}`;
}

export function InvoicesSection() {
  const { state, can } = useAdmin();
  const readOnly = can("invoices") !== "manage";
  const { list, replace, loading, error, reload } = useInvoices();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [busy, setBusy] = useState(false);

  const setStatus = async (invoice: Invoice, status: InvoiceStatus) => {
    if (busy) return;
    setBusy(true);
    try {
      replace(await patchInvoice(invoice.id, { status }));
      toast.success(`${invoice.id} → ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the invoice");
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const selected = selectedId ? list.find((i) => i.id === selectedId) : null;

  if (selected) {
    return (
      <div className="flex flex-col gap-4">
        <div className="no-print flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-secondary px-3.5 text-[13px] font-bold text-zup-mid transition-colors hover:bg-zup-body/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to invoices
          </button>
          <h2 className="text-[18px] font-extrabold tracking-[-0.015em]">{selected.id}</h2>
          <Pill tone={invoiceStatusTone(selected.status)}>{selected.status}</Pill>
          <div className="ml-auto flex items-center gap-2">
            {readOnly ? null : (
              <select
                value={selected.status}
                disabled={busy}
                aria-label="Invoice status"
                onChange={(e) => void setStatus(selected, e.target.value as InvoiceStatus)}
                className={selectCls}
              >
                {INVOICE_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-zup-ink px-4 text-[13px] font-bold text-white transition-colors hover:bg-zup-body"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Print
            </button>
          </div>
        </div>
        <InvoiceDocument invoice={selected} contact={state.contact} />
      </div>
    );
  }

  const rows = list.filter((i) => {
    const needle = q.trim().toLowerCase();
    const matchQ =
      !needle ||
      i.id.toLowerCase().includes(needle) ||
      i.orderId.toLowerCase().includes(needle) ||
      i.customer.toLowerCase().includes(needle) ||
      i.phone.replace(/\D/g, "").includes(needle.replace(/\D/g, "") || " ");
    const matchStatus = statusFilter === "All statuses" || i.status === statusFilter;
    return matchQ && matchStatus;
  });

  const filtersActive = q.trim() !== "" || statusFilter !== "All statuses";
  const outstanding = list
    .filter((i) => i.status === "Issued")
    .reduce((sum, i) => sum + i.total, 0);

  const head = ["Invoice", "Order", "Customer", "Raised", "Total", "Status", ""];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search invoice, order, customer or phone…"
          aria-label="Search invoices"
          className={`${inputCls} max-w-[420px] flex-1 rounded-full`}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by invoice status"
          className={selectCls}
        >
          {["All statuses", ...INVOICE_STATUSES].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {filtersActive ? (
          <BtnGhost
            onClick={() => {
              setQ("");
              setStatusFilter("All statuses");
            }}
          >
            Reset filters
          </BtnGhost>
        ) : null}
      </div>

      <p className="text-[13px] font-semibold text-zup-soft">
        {rows.length} of {list.length} invoices
        {outstanding > 0 ? ` · ${taka(outstanding)} issued and unpaid` : ""}
      </p>

      {error ? (
        <Card className="px-5 py-8 text-center">
          <p className="text-[14px] font-semibold text-[#D32F2F]">Could not load invoices.</p>
          <div className="mt-3">
            <BtnGhost onClick={() => void reload()}>Try again</BtnGhost>
          </div>
        </Card>
      ) : (
        <Card className="px-2 py-2">
          <Table head={head} minWidth={900}>
            {rows.map((i) => (
              <tr key={i.id} className="last:[&>td]:border-0">
                <Td className="font-bold">{i.id}</Td>
                <Td className="text-zup-mid">{i.orderId}</Td>
                <Td className="text-zup-mid">
                  {i.customer}
                  <span className="block text-[12px] text-zup-gray">{i.phone}</span>
                </Td>
                <Td className="whitespace-nowrap text-[13px] text-zup-gray">
                  {shortDate(i.createdAt)}
                </Td>
                <Td className="whitespace-nowrap font-bold">{taka(i.total)}</Td>
                <Td>
                  {readOnly ? (
                    <Pill tone={invoiceStatusTone(i.status)}>{i.status}</Pill>
                  ) : (
                    <select
                      value={i.status}
                      disabled={busy}
                      aria-label={`Status of ${i.id}`}
                      onChange={(e) => void setStatus(i, e.target.value as InvoiceStatus)}
                      className={selectCls}
                    >
                      {INVOICE_STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  )}
                </Td>
                <Td>
                  <BtnGhost onClick={() => setSelectedId(i.id)}>Open</BtnGhost>
                </Td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <Td colSpan={head.length} className="py-10 text-center text-zup-soft">
                  {loading
                    ? "Loading invoices…"
                    : list.length === 0
                      ? "No invoices yet — raise one from an order in the Orders section."
                      : "No invoices match your search."}
                </Td>
              </tr>
            ) : null}
          </Table>
        </Card>
      )}
    </div>
  );
}
