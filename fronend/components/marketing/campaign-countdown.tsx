"use client";

import { useSyncExternalStore } from "react";

import { toBanglaDigits } from "@/lib/site";

/**
 * The urgency clock.
 *
 * `useSyncExternalStore` rather than state-plus-an-effect, because the clock is
 * exactly what that hook is for: an external source (wall time) that the
 * component subscribes to.
 *
 * The server snapshot is the SERVER's clock, stamped per request into `nowIso`
 * by the page — not a fixed zero. Zero was hydration-safe, but it meant the
 * HTML shipped ০০ ০০ ০০: on the one band of the page whose entire job is
 * urgency, the first paint read "offer over" until React caught up. Because
 * `nowIso` arrives as a prop, the server render and the hydration render read
 * the same value, so the snapshot is still stable and there is still no
 * mismatch — the real client time simply arrives on the first render after
 * hydration instead of a second later.
 *
 * A deadline in the past collapses to zeros rather than counting upwards; an
 * expired campaign should look finished, not broken.
 */
const subscribe = (onChange: () => void) => {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
};

// Whole seconds, so two calls inside one render return the same value.
const nowSeconds = () => Math.floor(Date.now() / 1000);

const HOUR = 3600;
const DAY = 24 * HOUR;

export function CampaignCountdown({
  endsAt,
  nowIso,
  labels,
}: {
  endsAt: string;
  /** The server's clock at render time. See the note above. */
  nowIso: string;
  /** Four labels, largest unit first: days, hours, minutes, seconds. */
  labels: string[];
}) {
  const now = useSyncExternalStore(subscribe, nowSeconds, () =>
    Math.floor(new Date(nowIso).getTime() / 1000),
  );

  const target = Math.floor(new Date(endsAt).getTime() / 1000);
  const total =
    Number.isNaN(target) || Number.isNaN(now) ? 0 : Math.max(0, target - now);

  const days = Math.floor(total / DAY);

  // `id` keys the list rather than the label or the index: labels are
  // caller-supplied and the array is sliced below, so neither is stable.
  const units = [
    { id: "d", value: days, label: labels[0] },
    { id: "h", value: Math.floor((total % DAY) / HOUR), label: labels[1] },
    { id: "m", value: Math.floor((total % HOUR) / 60), label: labels[2] },
    { id: "s", value: total % 60, label: labels[3] },
  ];

  /*
   * The days box appears only once there is at least one day left.
   *
   * Without a days unit at all, a four-day campaign rendered "৯৮ ঘণ্টা" — a
   * number nobody converts back into a deadline, and three digits in a box
   * sized for two. Always showing the box is the opposite failure: "০০ দিন"
   * on a six-hour campaign spends the widest slot on a zero.
   */
  const shown = days > 0 ? units : units.slice(1);

  return (
    <div className="flex items-center justify-center gap-2.5 sm:gap-3">
      {shown.map((unit) => (
        <div
          key={unit.id}
          /*
           * Fluid rather than a flat min-w-[74px]: four boxes at that width
           * plus gaps overflow a 360px phone, which is most of this page's
           * traffic. The min/max pair keeps three boxes looking as they did.
           */
          className="flex min-w-[62px] max-w-[86px] flex-1 flex-col items-center rounded-xl bg-white/10 px-2 py-2.5"
        >
          <span className="font-mono text-[26px] font-bold leading-none tabular-nums text-white">
            {toBanglaDigits(String(unit.value).padStart(2, "0"))}
          </span>
          <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-white/70">
            {unit.label ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}
