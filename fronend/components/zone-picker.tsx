"use client";

import { MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Delivery-zone selector, shared by the cart summary and checkout.
 *
 * The backend prices delivery and installation as a two-tier inside/outside
 * Dhaka boolean, so this is all the location detail the quote and order
 * endpoints actually take.
 */
export function ZonePicker({
  value,
  onChange,
  compact,
}: {
  value: boolean;
  onChange: (insideDhaka: boolean) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-2", compact && "gap-1.5")}>
      <span
        className={cn(
          "font-semibold text-zup-mid",
          compact ? "text-xs" : "text-[13px]",
        )}
      >
        Deliver to
      </span>
      <div
        role="radiogroup"
        aria-label="Delivery zone"
        className="inline-flex rounded-full bg-zup-body/6 p-1"
      >
        {[
          { inside: true, label: "Inside Dhaka" },
          { inside: false, label: "Outside Dhaka" },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={value === o.inside}
            onClick={() => onChange(o.inside)}
            className={cn(
              "cursor-pointer rounded-full font-bold transition-colors",
              compact ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-[13px]",
              value === o.inside
                ? "bg-zup-ink text-white"
                : "text-zup-gray hover:text-zup-body",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {!compact ? (
        <p className="flex items-center gap-1.5 text-[12px] text-zup-faint">
          <MapPinned className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
          Delivery and installation charges depend on this.
        </p>
      ) : null}
    </div>
  );
}
