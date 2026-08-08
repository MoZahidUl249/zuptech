"use client";

import { useSyncExternalStore } from "react";

import { toBanglaDigits } from "@/lib/site";

/**
 * The urgency clock.
 *
 * `useSyncExternalStore` rather than state-plus-an-effect, because the clock is
 * exactly what that hook is for: an external source (wall time) that the
 * component subscribes to. It also solves the hydration problem for free — the
 * server snapshot is a fixed 0, so the HTML and the first client render agree,
 * and the real remaining time arrives on the first tick instead of as a
 * mismatch on the busiest page the business runs.
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
const serverSeconds = () => 0;

export function CampaignCountdown({ endsAt, labels }: { endsAt: string; labels: string[] }) {
  const now = useSyncExternalStore(subscribe, nowSeconds, serverSeconds);

  const target = Math.floor(new Date(endsAt).getTime() / 1000);
  // `now === 0` is the server/hydration snapshot, not a real time — showing the
  // full remaining duration there would flash the wrong number before settling.
  const total =
    now === 0 || Number.isNaN(target) ? 0 : Math.max(0, target - now);

  const parts = [
    Math.floor(total / 3600),
    Math.floor((total % 3600) / 60),
    total % 60,
  ];

  return (
    <div className="flex items-center justify-center gap-3">
      {parts.map((v, i) => (
        <div
          key={i}
          className="flex min-w-[74px] flex-col items-center rounded-xl bg-white/10 px-3 py-2.5"
        >
          <span className="font-mono text-[26px] font-bold leading-none tabular-nums text-white">
            {toBanglaDigits(String(v).padStart(2, "0"))}
          </span>
          <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-white/70">
            {labels[i] ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}
