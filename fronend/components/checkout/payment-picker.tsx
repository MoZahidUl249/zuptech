"use client";

import type { PaymentOption } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Which payment method, as big tappable cards rather than a dropdown. */
export function PaymentPicker({
  options,
  value,
  onChange,
}: {
  options: PaymentOption[];
  value: string;
  onChange: (label: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Payment method">
      {options.map((p) => {
        const on = value === p.label;
        return (
          <button
            key={p.label}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(p.label)}
            className={cn(
              "flex min-h-14 cursor-pointer items-center gap-[13px] rounded-2xl border-2 bg-white p-4 text-left transition-colors",
              on ? "border-zup-blue" : "border-zup-body/8 hover:border-zup-body/20",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 flex-none items-center justify-center rounded-full border-2",
                on ? "border-zup-blue" : "border-zup-body/25",
              )}
            >
              <span
                className={cn("h-2.5 w-2.5 rounded-full", on ? "bg-zup-blue" : "bg-transparent")}
              />
            </span>
            <span className="flex flex-col gap-px">
              <span className="text-[15px] font-bold">{p.label}</span>
              <span className="text-[12.5px] text-zup-soft">{p.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
