"use client";

import type { Quote } from "@/lib/quote";
import { formatBDT } from "@/lib/site";

/**
 * What the customer will be charged. Every figure comes from the server's
 * quote — nothing here is computed in the browser (cal-bk.md).
 */
export function OrderSummary({
  quote,
  error,
  count,
  insideDhaka,
}: {
  quote: Quote | null;
  error: boolean;
  count: number;
  insideDhaka: boolean;
}) {
  const money = (v: number | null | undefined) => (v == null ? "…" : formatBDT(v));

  return (
    <div className="flex flex-col gap-[7px] rounded-2xl border border-zup-body/6 bg-white px-4.5 py-4">
      <div className="flex justify-between text-[13.5px] text-zup-gray">
        <span>
          {count} item{count === 1 ? "" : "s"}
        </span>
        <span>{money(quote?.subtotal)}</span>
      </div>
      <div className="flex justify-between text-[13.5px] text-zup-gray">
        <span>Delivery · {insideDhaka ? "Inside Dhaka" : "Outside Dhaka"}</span>
        <span>
          {quote?.deliveryFee == null
            ? "…"
            : quote.deliveryFee === 0
              ? "Free"
              : formatBDT(quote.deliveryFee)}
        </span>
      </div>
      {quote?.installationFee ? (
        <div className="flex justify-between text-[13.5px] text-zup-gray">
          <span>Installation</span>
          <span>{formatBDT(quote.installationFee)}</span>
        </div>
      ) : null}
      <div className="h-px bg-zup-body/7" />
      <div className="flex justify-between text-base font-extrabold">
        <span>Total</span>
        <span>{money(quote?.total)}</span>
      </div>
      {error ? (
        <p className="text-[12.5px] font-medium text-destructive" role="alert">
          Couldn&apos;t load prices from the server — please retry.
        </p>
      ) : null}
    </div>
  );
}
