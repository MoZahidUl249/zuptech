"use client";

import { Plus } from "lucide-react";
import {
  Pill,
  BtnGhost,
  BtnDanger,
  inputCls,
} from "../ui";
import { } from "../confirm-dialog";

/* ===== Offer ladders ===== */

/** Both ladders are `{minQty, amount}` lists with the same rules, so one editor
 *  serves both. Mirrors the backend contract in products.dto.ts: minQty 2–999,
 *  amount ≥ ৳1, at most 10 tiers, minQty unique. There is no upper bound on the
 *  amount — exceeding the delivery fee is exactly how free delivery is
 *  expressed, and rules.ts floors the result at zero. */
export interface OfferTier {
  minQty: number;
  amount: number;
}

export const MAX_OFFER_TIERS = 10;

/** minQty values that appear more than once — the same check the backend runs
 *  (`duplicateMinQtys` in rules.ts), surfaced before the request instead of as
 *  a 400. Generic over the row shape because the campaign ladder is
 *  `{minQty, unitPrice}` and enforces the identical rule; only `minQty` is
 *  read either way. */
export function duplicateMinQtys<T extends { minQty: number }>(tiers: T[]): number[] {
  const seen = new Set<number>();
  const dupes = new Set<number>();
  for (const { minQty } of tiers) {
    if (seen.has(minQty)) dupes.add(minQty);
    seen.add(minQty);
  }
  return [...dupes];
}

export function OfferTierEditor({
  label,
  hint,
  unitLabel,
  freeAt,
  tiers,
  onChange,
}: {
  label: string;
  hint: string;
  /** Text after the amount input, e.g. "৳ off each unit". */
  unitLabel: string;
  /** Delivery ladders only: the dearest zone fee, so a tier that covers it can
   *  be badged "Free". Omitted for quantity ladders, which have no such point. */
  freeAt?: number;
  tiers: OfferTier[];
  onChange: (next: OfferTier[]) => void;
}) {
  const dupes = duplicateMinQtys(tiers);

  const patch = (i: number, field: keyof OfferTier, raw: string) => {
    const n = Math.round(Number(raw) || 0);
    // Clamped on every keystroke. Only minQty has a ceiling; the amount is money.
    const value = field === "minQty" ? Math.min(999, Math.max(2, n)) : Math.max(1, n);
    onChange(tiers.map((t, j) => (j === i ? { ...t, [field]: value } : t)));
  };

  return (
    <div className="rounded-2xl border border-zup-body/10 bg-zup-bg/60 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-ui-micro font-bold uppercase tracking-[0.08em] text-zup-soft">{label}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-zup-soft">{hint}</p>
        </div>
        <BtnGhost
          type="button"
          disabled={tiers.length >= MAX_OFFER_TIERS}
          // New tiers start one above the current top so the ladder stays
          // ordered and duplicate-free without the admin thinking about it.
          onClick={() =>
            onChange([
              ...tiers,
              { minQty: Math.min(999, Math.max(2, ...tiers.map((t) => t.minQty + 1))), amount: 100 },
            ])
          }
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> Add tier
        </BtnGhost>
      </div>

      {tiers.length === 0 ? (
        <p className="mt-3 text-ui-sm text-zup-faint">No tiers — this offer is off.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {tiers.map((tier, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span className="text-ui-sm font-semibold text-zup-gray">Buy</span>
              <input
                type="number"
                inputMode="numeric"
                min={2}
                max={999}
                aria-label={`${label} tier ${i + 1} — minimum quantity`}
                value={tier.minQty}
                onChange={(e) => patch(i, "minQty", e.target.value)}
                // Sorted on blur so the saved order matches what the server
                // returns (minQty ascending) and the rows stop jumping mid-type.
                onBlur={() => onChange([...tiers].sort((a, b) => a.minQty - b.minQty))}
                className={`${inputCls} w-20`}
              />
              <span className="text-ui-sm font-semibold text-zup-gray">+ &rarr;</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                aria-label={`${label} tier ${i + 1} — amount in Taka`}
                value={tier.amount}
                onChange={(e) => patch(i, "amount", e.target.value)}
                className={`${inputCls} w-20`}
              />
              <span className="text-ui-sm text-zup-gray">{unitLabel}</span>
              {freeAt !== undefined && tier.amount >= freeAt ? (
                <Pill tone="green">Free</Pill>
              ) : null}
              <BtnDanger
                type="button"
                className="ml-auto"
                onClick={() => onChange(tiers.filter((_, j) => j !== i))}
              >
                Remove
              </BtnDanger>
            </li>
          ))}
        </ul>
      )}

      {dupes.length > 0 ? (
        <p className="mt-2.5 text-ui-xs font-semibold text-destructive">
          Two tiers both start at {dupes.join(", ")} — each tier needs its own quantity.
        </p>
      ) : null}
    </div>
  );
}
