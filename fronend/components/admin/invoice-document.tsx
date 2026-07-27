"use client";

import { taka, type Invoice, type SiteContact } from "@/lib/admin";

/*
 * The printable invoice. Marked `.print-doc` so the print rules in
 * globals.css hide the rest of the admin panel and lay this out on A4 —
 * there is no PDF library in this project and none is needed.
 *
 * All money comes off the `Invoice` payload, which the backend derives from
 * the order's frozen checkout totals. Nothing is recomputed here.
 */

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })} ${d.getFullYear()}`;
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? "flex items-baseline justify-between border-t-2 border-zup-body/20 pt-2.5 text-[15px] font-extrabold"
          : "flex items-baseline justify-between text-[13px]"
      }
    >
      <span className={strong ? "" : "text-zup-gray"}>{label}</span>
      <span className="[font-variant-numeric:tabular-nums]">{value}</span>
    </div>
  );
}

export function InvoiceDocument({
  invoice,
  contact,
}: {
  invoice: Invoice;
  contact: SiteContact;
}) {
  const isVoid = invoice.status === "Void";

  return (
    <div className="print-doc rounded-2xl border border-zup-body/8 bg-white px-7 py-7 text-zup-body sm:px-9 sm:py-9">
      {/* Letterhead */}
      <div className="flex flex-wrap items-start justify-between gap-5 border-b-2 border-zup-body/12 pb-5">
        <div>
          <p className="text-[19px] font-extrabold tracking-[-0.02em]">ZUP TECH</p>
          <p className="mt-1 max-w-[240px] text-[11.5px] leading-relaxed text-zup-gray">
            {contact.street}
            {contact.street && contact.city ? ", " : ""}
            {contact.city}
            {contact.postalCode ? ` ${contact.postalCode}` : ""}
            <br />
            {contact.phoneDisplay || contact.phone}
            {contact.email ? ` · ${contact.email}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zup-gray">
            {isVoid ? "Invoice (void)" : "Invoice"}
          </p>
          <p className="mt-1 text-[22px] font-extrabold tracking-[-0.02em]">{invoice.id}</p>
          <p className="mt-1 text-[11.5px] text-zup-gray">
            Order {invoice.orderId} · {fmtDate(invoice.createdAt)}
          </p>
          {isVoid ? (
            <p className="mt-1.5 inline-block rounded border-2 border-[#D32F2F] px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#D32F2F]">
              Void
            </p>
          ) : null}
        </div>
      </div>

      {/* Parties + dates */}
      <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_auto]">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-zup-gray">
            Billed to
          </p>
          <p className="mt-1.5 text-[14.5px] font-bold">{invoice.customer}</p>
          <p className="text-[12.5px] text-zup-mid">{invoice.phone}</p>
          <p className="mt-0.5 max-w-[320px] text-[12.5px] leading-relaxed text-zup-gray">
            {invoice.address}
          </p>
        </div>
        <div className="flex flex-col gap-1 text-[12.5px] sm:text-right">
          <p>
            <span className="text-zup-gray">Issued: </span>
            {fmtDate(invoice.issuedAt)}
          </p>
          <p>
            <span className="text-zup-gray">Paid: </span>
            {fmtDate(invoice.paidAt)}
          </p>
          <p>
            <span className="text-zup-gray">Payment: </span>
            {invoice.pay}
          </p>
        </div>
      </div>

      {/* Lines */}
      <table className="mt-6 w-full border-collapse text-left">
        <thead>
          <tr className="border-b-2 border-zup-body/12">
            <th className="py-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-zup-gray">
              Item
            </th>
            <th className="py-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-zup-gray">
              SKU
            </th>
            <th className="py-2 text-right text-[10.5px] font-bold uppercase tracking-[0.12em] text-zup-gray">
              Qty
            </th>
            <th className="py-2 text-right text-[10.5px] font-bold uppercase tracking-[0.12em] text-zup-gray">
              Unit price
            </th>
            <th className="py-2 text-right text-[10.5px] font-bold uppercase tracking-[0.12em] text-zup-gray">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item) => (
            <tr key={item.productId} className="border-b border-zup-body/8">
              <td className="py-2.5 text-[13px] font-semibold">{item.name}</td>
              <td className="py-2.5 text-[12px] text-zup-gray">{item.sku}</td>
              <td className="py-2.5 text-right text-[13px] [font-variant-numeric:tabular-nums]">
                {item.qty}
              </td>
              <td className="py-2.5 text-right text-[13px] [font-variant-numeric:tabular-nums]">
                {taka(item.unitPrice)}
              </td>
              <td className="py-2.5 text-right text-[13px] font-bold [font-variant-numeric:tabular-nums]">
                {taka(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="mt-5 flex justify-end">
        <div className="flex w-full max-w-[280px] flex-col gap-2">
          <Row label="Subtotal" value={taka(invoice.subtotal)} />
          <Row label="Delivery" value={taka(invoice.deliveryFee)} />
          <Row label="Installation" value={taka(invoice.installationFee)} />
          <Row label="Total" value={taka(invoice.total)} strong />
        </div>
      </div>

      {invoice.notes ? (
        <p className="mt-6 max-w-[420px] whitespace-pre-wrap text-[12px] leading-relaxed text-zup-gray">
          {invoice.notes}
        </p>
      ) : null}

      {/* Accountability — the whole point of the prepared-by field */}
      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <div>
          <div className="h-9 border-b border-zup-body/25" />
          <p className="mt-1.5 text-[11.5px] text-zup-gray">
            Prepared by
            {invoice.preparedBy ? (
              <span className="font-semibold text-zup-body"> — {invoice.preparedBy}</span>
            ) : null}
          </p>
        </div>
        <div>
          <div className="h-9 border-b border-zup-body/25" />
          <p className="mt-1.5 text-[11.5px] text-zup-gray">
            Authorised signature
            {invoice.issuedBy ? (
              <span className="font-semibold text-zup-body"> — {invoice.issuedBy}</span>
            ) : null}
          </p>
        </div>
      </div>

      <p className="mt-7 text-center text-[10.5px] text-zup-faint">
        This is a computer-generated invoice from ZUP TECH.
        {contact.hotline ? ` For queries call ${contact.hotline}.` : ""}
      </p>
    </div>
  );
}
