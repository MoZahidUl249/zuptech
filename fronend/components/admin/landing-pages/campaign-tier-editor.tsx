"use client";

import { Plus } from "lucide-react";
import { BtnGhost, BtnDanger, inputCls } from "../ui";
import { duplicateMinQtys } from "../products/offer-tier-editor";
import { taka } from "@/lib/admin";

/**
 * One campaign's own bulk ladder: "buy N+, pay ৳P each".
 *
 * A sibling of `OfferTierEditor`, not a mode on it. That component's whole
 * surface encodes the amount-off model — the minQty ≥ 2 floor, "৳ off each
 * unit", the "Free" pill — and it is mounted on the Products screen, where a
 * regression is a live storefront pricing bug. The two share the duplicate
 * check and the layout idiom and diverge on every rule, which is a sibling.
 *
 * The number typed here is what the customer PAYS, not what they save. That is
 * the entire reason this table exists: the product's ladder stores taka off the
 * list price and is then capped by the sale price, so a ৳200 tier on a ৳2,600
 * product selling at ৳2,184 was worth nothing while the page advertised a
 * saving. An absolute price cannot be quietly swallowed that way.
 */
export interface CampaignTier {
  minQty: number;
  unitPrice: number;
}

const MAX_CAMPAIGN_TIERS = 10;

export function CampaignTierEditor({
  tiers,
  onChange,
  shopPrice,
  unitLabel,
  bundleMaxQty,
  disabled,
}: {
  tiers: CampaignTier[];
  onChange: (next: CampaignTier[]) => void;
  /** What checkout charges per unit without a campaign, for the inert check. */
  shopPrice: number;
  /** The campaign's own word for one unit, so rows read in its language. */
  unitLabel: string;
  /** How many rows the page draws — a tier above it is invisible but charged. */
  bundleMaxQty: number;
  disabled?: boolean;
}) {
  const dupes = duplicateMinQtys(tiers);
  const unit = unitLabel.trim() || "pcs";

  const patch = (i: number, field: keyof CampaignTier, raw: string) => {
    const n = Math.round(Number(raw) || 0);
    /* minQty starts at 1, unlike the product ladders: a campaign may price a
       single unit differently from the shop, which is what an ad price is. */
    const value = field === "minQty" ? Math.min(99, Math.max(1, n)) : Math.max(0, n);
    onChange(tiers.map((t, j) => (j === i ? { ...t, [field]: value } : t)));
  };

  return (
    <div className="rounded-2xl border border-zup-body/10 bg-zup-bg/60 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-ui-micro font-bold uppercase tracking-[0.08em] text-zup-soft">
            This campaign&apos;s prices
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-zup-soft">
            What a buyer pays per {unit} at each quantity. Charged at checkout,
            and used for the bundle rows on the page.
          </p>
        </div>
        <BtnGhost
          type="button"
          disabled={disabled || tiers.length >= MAX_CAMPAIGN_TIERS}
          // Seeded one quantity above the current top, at today's shop price,
          // so a new row is ordered, duplicate-free and inert until edited —
          // never a silent discount nobody meant to give.
          onClick={() =>
            onChange([
              ...tiers,
              {
                minQty: Math.min(99, Math.max(2, ...tiers.map((t) => t.minQty + 1))),
                unitPrice: shopPrice,
              },
            ])
          }
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> Add tier
        </BtnGhost>
      </div>

      {tiers.length === 0 ? (
        <p className="mt-3 text-ui-sm text-zup-faint">
          No tiers — this page prices exactly like the shop ({taka(shopPrice)} each).
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {tiers.map((tier, i) => {
            const inert = tier.unitPrice >= shopPrice;
            const unseen = tier.minQty > bundleMaxQty;
            return (
              <li key={i} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-ui-sm font-semibold text-zup-gray">Buy</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={99}
                    disabled={disabled}
                    aria-label={`Tier ${i + 1} — minimum quantity`}
                    value={tier.minQty}
                    onChange={(e) => patch(i, "minQty", e.target.value)}
                    // Sorted on blur so the saved order matches what the server
                    // returns and the rows stop jumping mid-type.
                    onBlur={() => onChange([...tiers].sort((a, b) => a.minQty - b.minQty))}
                    className={`${inputCls} w-20`}
                  />
                  <span className="text-ui-sm font-semibold text-zup-gray">+ &rarr; ৳</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    disabled={disabled}
                    aria-label={`Tier ${i + 1} — price per ${unit}`}
                    value={tier.unitPrice}
                    onChange={(e) => patch(i, "unitPrice", e.target.value)}
                    className={`${inputCls} w-24`}
                  />
                  <span className="text-ui-sm text-zup-gray">
                    each · {taka(tier.unitPrice * tier.minQty)} for {tier.minQty} {unit}
                  </span>
                  <BtnDanger
                    type="button"
                    disabled={disabled}
                    className="ml-auto"
                    onClick={() => onChange(tiers.filter((_, j) => j !== i))}
                  >
                    Remove
                  </BtnDanger>
                </div>

                {/* A tier at or above the shop price is not an error — it is
                    simply ignored, and saying so beats letting someone believe
                    they set a discount. */}
                {inert ? (
                  <p className="text-ui-xs leading-snug text-warn-fg">
                    {taka(tier.unitPrice)} is not below the shop price
                    ({taka(shopPrice)}), so this tier does nothing — buyers already
                    get the better price.
                  </p>
                ) : null}
                {unseen ? (
                  <p className="text-ui-xs leading-snug text-warn-fg">
                    Above the last bundle row, so nobody sees it on the page —
                    though it is still charged at checkout. Raise the row count
                    to {tier.minQty} to show it.
                  </p>
                ) : null}
              </li>
            );
          })}
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
