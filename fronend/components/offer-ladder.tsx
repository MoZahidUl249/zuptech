import { Tag, TrendingDown, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/products";
import { nextRung, offerLadder, type OfferRung } from "@/lib/pricing-display";

/*
 * Every promotion on a product, in the order a customer unlocks them.
 *
 * INVARIANT (cal-bk.md): this renders *labels*, never money. The rungs come
 * from lib/pricing-display.ts `offerLadder`, which reads the product's own
 * tier lists; the amount actually charged always comes from
 * POST /api/pricing/quote. Passing `qty` only changes which rungs are shown as
 * earned — it never derives a price.
 *
 * Two densities so the product page, the cart line and the landing page
 * describe the same offers in the same words:
 *   panel — the full ladder, for a product page or landing page
 *   line  — a compact strip, for a cart line
 *
 * There was a third, `badges`: inline pills for the product card. The card was
 * stripped back to image/name/price on 2026-08-13, which left it with no
 * consumer, and it was deleted rather than kept on spec. A surface that wants
 * offers in a few square centimetres should add the density it needs against
 * `offerLadder`, not revive a rendering shaped for a card that no longer
 * exists.
 */

const RUNG_ICONS = {
  sale: Tag,
  qty: TrendingDown,
  delivery: Truck,
} as const;

export function OfferLadder({
  product,
  qty,
  variant = "panel",
  title = "Offers on this product",
  className,
}: {
  product: Product;
  /** Quantity in hand. Omit where none has been chosen — every rung then
   *  renders as an available offer rather than an earned one. */
  qty?: number;
  variant?: "panel" | "line";
  title?: string;
  className?: string;
}) {
  const rungs = offerLadder(product, qty);
  if (rungs.length === 0) return null;

  if (variant === "line") return <OfferLine rungs={rungs} className={className} />;
  return <OfferPanel rungs={rungs} title={title} qty={qty} className={className} />;
}

/* ===== panel — product page + landing page ===== */

function OfferPanel({
  rungs,
  title,
  qty,
  className,
}: {
  rungs: OfferRung[];
  title: string;
  qty?: number;
  className?: string;
}) {
  const next = nextRung(rungs);
  const anyActive = rungs.some((r) => r.state === "active");

  return (
    <section
      className={cn(
        "zup-fade-up overflow-hidden rounded-[2px] border border-zup-body/8 bg-white",
        className,
      )}
      aria-label={title}
    >
      <h3 className="border-b border-zup-body/6 bg-zup-bg/70 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.09em] text-zup-gray">
        {title}
      </h3>

      <ul className="flex flex-col">
        {rungs.map((rung, i) => {
          const Icon = RUNG_ICONS[rung.kind];
          const active = rung.state === "active";
          return (
            <li
              key={i}
              className={cn(
                "flex items-center gap-3 border-b border-zup-body/5 px-4 py-2.5 last:border-b-0",
                active && "bg-zup-green/6",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 flex-none items-center justify-center rounded-full",
                  active
                    ? "bg-zup-green/15 text-zup-green-dark"
                    : rung.kind === "sale"
                      ? "bg-zup-orange/12 text-zup-orange-dark"
                      : "bg-zup-body/5 text-zup-soft",
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-[13.5px] font-bold",
                    active ? "text-zup-green-dark" : "text-zup-body",
                  )}
                >
                  {rung.label}
                </span>
                <span className="block text-[12px] text-zup-gray">{rung.detail}</span>
              </span>

              {active ? (
                <span className="flex-none rounded-full bg-zup-green px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.06em] text-white">
                  Applied
                </span>
              ) : rung.unitsAway !== null ? (
                <span className="flex-none text-[11.5px] font-semibold text-zup-soft">
                  {rung.unitsAway} more
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      {next && next.minQty !== null && qty !== undefined ? (
        <div className="border-t border-zup-body/6 px-4 py-3">
          <p
            className="mb-1.5 text-[12.5px] font-semibold text-zup-body"
            // Announced as the stepper changes, so the nudge isn't
            // sighted-only feedback.
            aria-live="polite"
          >
            Add {next.unitsAway} more to unlock{" "}
            <span className="text-zup-green-dark">{next.detail.toLowerCase()}</span>
          </p>
          <TierProgress value={qty} target={next.minQty} />
        </div>
      ) : anyActive ? (
        <p className="border-t border-zup-body/6 px-4 py-3 text-[12.5px] font-semibold text-zup-green-dark">
          You&apos;ve unlocked every offer on this product.
        </p>
      ) : null}
    </section>
  );
}

/** Progress toward the next rung. Presentational only — `aria-hidden`, since
 *  the sentence above already states the same thing in words. */
function TierProgress({ value, target }: { value: number; target: number }) {
  const pct = Math.max(6, Math.min(100, Math.round((value / target) * 100)));
  return (
    <span className="flex items-center gap-2" aria-hidden>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zup-body/8">
        {/* Width is a CSS transition, matching the app's no-JS-animation rule
            (globals.css); prefers-reduced-motion is handled globally there. */}
        <span
          className="block h-full rounded-full bg-zup-green transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-[11px] font-bold tabular-nums text-zup-soft">
        {value} / {target}
      </span>
    </span>
  );
}

/* ===== line — cart ===== */

/**
 * The cart already prints what the line costs and why it dropped (the
 * server-priced total plus a "Buy 5+ · 10% off" badge), so this adds only what
 * that can't say: the delivery break earned, and the nearest rung not yet
 * reached. Listing every earned rung here would restate the badge and stack
 * four near-identical green lines under a single cart row.
 */
function OfferLine({ rungs, className }: { rungs: OfferRung[]; className?: string }) {
  // Rungs arrive minQty-ascending within each kind, so the last active
  // delivery rung is the best one earned — and only that one is worth saying.
  // If it's a full break, say nothing: the cart already states "Free delivery"
  // from the server's own zeroed fee, which is the authoritative claim. This
  // fills in only the partial break the cart total can't express, which is why
  // the test is on the rung's own wording rather than on the amount: whether a
  // given amount clears the fee depends on the delivery zone.
  const bestDelivery = rungs.filter((r) => r.state === "active" && r.kind === "delivery").at(-1);
  const delivery =
    bestDelivery && !/free delivery/i.test(bestDelivery.detail) ? bestDelivery : undefined;
  const next = nextRung(rungs);
  if (!delivery && !next) return null;

  return (
    <span className={cn("flex flex-col gap-0.5", className)}>
      {delivery ? (
        <span className="flex items-center gap-1 text-[11.5px] font-semibold text-zup-green-dark">
          <Truck className="h-3 w-3" strokeWidth={2} aria-hidden />
          {delivery.detail}
        </span>
      ) : null}
      {next ? (
        <span className="flex items-center gap-1 text-[11.5px] text-zup-gray" aria-live="polite">
          <TrendingDown className="h-3 w-3" strokeWidth={1.8} aria-hidden />
          Add {next.unitsAway} more for {next.detail.toLowerCase()}
        </span>
      ) : null}
    </span>
  );
}
