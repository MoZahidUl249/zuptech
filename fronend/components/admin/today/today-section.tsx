"use client";

import Link from "next/link";
import { ArrowRight, PartyPopper } from "lucide-react";
import { useAdmin, bd, taka } from "@/lib/admin";
import { useAdminMetrics } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import { BarChart } from "../charts";
import { EmptyState, PageHeader } from "../primitives";
import { Card, KpiCard, Pill, orderStatusTone } from "../ui";
import { useAttention, type AttentionItem } from "./attention";

/**
 * The admin's home screen.
 *
 * The old Dashboard opened with four KPI tiles, a chart, and a list of recent
 * orders that wasn't clickable — accurate, and no help at all if what you
 * wanted was to know what to do. This leads with the work: a list of plain
 * sentences, each with one button that lands on the right screen with the
 * right filter already applied. Numbers come second.
 */
export function TodaySection() {
  const { state, user, can } = useAdmin();
  const attention = useAttention();
  const { data: metrics, error } = useAdminMetrics("week");

  const firstName = user?.name.split(" ")[0] ?? "there";
  const total = attention.length;

  const rev14 = metrics?.revenue14d ?? [];
  const revValues = rev14.map((d) => d.revenue);
  const revLabels = rev14.map((d, i) => {
    if (i !== 0 && i !== rev14.length - 1) return String(i + 1);
    const date = new Date(d.date);
    return `${date.getDate()} ${date.toLocaleString("en", { month: "short" })}`;
  });
  const revTotal = metrics?.kpis.revenueThisWeek.value ?? 0;
  const pctNote = (pct: number) => `${pct >= 0 ? "+" : ""}${pct}% vs last week`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        help={
          total === 0
            ? "Nothing needs you right now."
            : `${total} ${total === 1 ? "thing needs" : "things need"} you today.`
        }
      />

      {/* ===== The work ===== */}
      <section>
        <h2 className="mb-3 text-ui-lg font-bold tracking-[-0.01em]">Needs you now</h2>
        {attention.length === 0 ? (
          <EmptyState
            icon={PartyPopper}
            title="All caught up"
            help="No orders waiting, no low stock, nobody waiting on a call back. Enjoy it."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {attention.map((item) => (
              <AttentionRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </section>

      {/* ===== The numbers ===== */}
      <section>
        <h2 className="mb-3 text-ui-lg font-bold tracking-[-0.01em]">How the shop is doing</h2>

        {error ? (
          <Card className="mb-3 px-5 py-4 text-ui-sm text-zup-gray">
            Couldn&apos;t load this week&apos;s figures — the numbers below may be
            incomplete.
          </Card>
        ) : null}

        <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
          <KpiCard
            label="Orders this week"
            value={metrics ? String(metrics.kpis.ordersThisWeek.value) : "—"}
            note={metrics ? pctNote(metrics.kpis.ordersThisWeek.pctChange) : ""}
            tone="green"
          />
          <KpiCard
            label="Money in this week"
            value={metrics ? taka(revTotal) : "—"}
            note={metrics ? pctNote(metrics.kpis.revenueThisWeek.pctChange) : ""}
            tone="green"
          />
          <KpiCard
            label="Service requests open"
            value={metrics ? String(metrics.kpis.openLeads.value) : "—"}
            note={metrics ? `${metrics.kpis.openLeads.newToday} came in today` : ""}
            tone="amber"
          />
          <KpiCard
            label="Products running low"
            value={metrics ? String(metrics.kpis.lowStockCount) : "—"}
            note={metrics ? `${metrics.kpis.openPoCount} on order` : ""}
            tone="red"
          />
        </div>
      </section>

      <Card className="px-5 py-4.5 sm:px-6">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-ui-base font-bold">Money in — last 14 days</h2>
          {metrics ? (
            <p className="text-ui-xs text-zup-soft">This week ৳ {bd(revTotal)}</p>
          ) : null}
        </div>
        {revValues.length > 0 ? (
          <BarChart values={revValues} labels={revLabels} format={taka} />
        ) : (
          <p className="py-8 text-center text-ui-sm text-zup-soft">
            {error ? "Figures unavailable." : "Loading…"}
          </p>
        )}
      </Card>

      {can("orders") !== "none" ? (
        <Card className="px-5 py-4.5 sm:px-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-ui-base font-bold">Latest orders</h2>
            <Link
              href="/admin/orders"
              className="text-ui-sm font-bold text-zup-blue transition-colors hover:text-zup-blue-dark"
            >
              See all
            </Link>
          </div>
          <ul>
            {state.orders.slice(0, 5).map((o) => (
              <li key={o.id} className="border-b border-zup-body/5 last:border-0">
                {/* Was a plain <li> — a list of orders you couldn't click,
                    so the only way in was to go to Orders and search. */}
                <Link
                  href={`/admin/orders?q=${encodeURIComponent(o.id)}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-1 py-3 outline-none transition-colors hover:bg-surface-sunken focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="w-20 text-ui-sm font-bold">{o.id}</span>
                  <span className="min-w-0 flex-1 truncate text-ui-sm text-zup-mid">
                    {o.customer}
                  </span>
                  <span className="text-ui-sm font-bold">{taka(o.total)}</span>
                  <Pill tone={orderStatusTone(o.status)}>{o.status}</Pill>
                </Link>
              </li>
            ))}
            {state.orders.length === 0 ? (
              <li className="py-6 text-center text-ui-sm text-zup-soft">No orders yet.</li>
            ) : null}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

const TONES = {
  urgent: "bg-destructive/10 text-destructive",
  warn: "bg-warn-bg text-warn-fg",
  info: "bg-info-bg text-info-fg",
} as const;

function AttentionRow({ item }: { item: AttentionItem }) {
  return (
    <li>
      <Link
        href={item.href}
        className="flex items-center gap-3.5 rounded-2xl border border-zup-body/8 bg-white px-4 py-3.5 outline-none transition-colors hover:border-zup-body/16 hover:bg-surface-sunken focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            TONES[item.tone],
          )}
        >
          <item.icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1 text-ui-base font-semibold text-zup-body">
          {item.text}
        </span>
        <span className="hidden shrink-0 items-center gap-1.5 text-ui-sm font-bold text-zup-blue sm:flex">
          {item.action}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
        </span>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-zup-soft sm:hidden"
          strokeWidth={2.4}
          aria-hidden
        />
      </Link>
    </li>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
