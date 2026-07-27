"use client";

import { useAdmin, bd, taka } from "@/lib/admin";
import { useAdminMetrics } from "@/lib/admin-api";
import { Card, KpiCard, Pill, orderStatusTone } from "./ui";
import { BarChart } from "./charts";

export function DashboardSection() {
  const { state } = useAdmin();
  // Live figures from GET /admin/api/metrics — nothing is computed client-side.
  const { data: metrics, error } = useAdminMetrics("week");

  const openLeads = state.leads.filter((l) => l.status !== "Won" && l.status !== "Lost").length;
  const newLeads = state.leads.filter((l) => l.status === "New").length;

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
    <div className="flex flex-col gap-5">
      {error ? (
        <Card className="px-5 py-4 text-[13.5px] text-zup-gray">
          Couldn&apos;t load metrics from the server — figures below may be incomplete.
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <KpiCard
          label="Orders this week"
          value={metrics ? String(metrics.kpis.ordersThisWeek.value) : "…"}
          note={metrics ? pctNote(metrics.kpis.ordersThisWeek.pctChange) : ""}
          tone="green"
        />
        <KpiCard
          label="Revenue this week"
          value={metrics ? taka(revTotal) : "…"}
          note={metrics ? pctNote(metrics.kpis.revenueThisWeek.pctChange) : ""}
          tone="green"
        />
        <KpiCard
          label="Open service leads"
          value={metrics ? String(metrics.kpis.openLeads.value) : String(openLeads)}
          note={`${metrics ? metrics.kpis.openLeads.newToday : newLeads} new today`}
          tone="amber"
        />
        <KpiCard
          label="Low-stock products"
          value={metrics ? String(metrics.kpis.lowStockCount) : "…"}
          note={metrics ? `${metrics.kpis.openPoCount} open POs` : "restock needed"}
          tone="red"
        />
      </div>

      <Card className="px-5 py-4.5 sm:px-6">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-bold">Revenue — last 14 days</h2>
          {metrics ? (
            <p className="text-xs text-zup-soft">This week ৳ {bd(revTotal)}</p>
          ) : null}
        </div>
        {revValues.length > 0 ? (
          <BarChart values={revValues} labels={revLabels} format={taka} />
        ) : (
          <p className="py-8 text-center text-[13px] text-zup-soft">
            {error ? "Metrics unavailable." : "Loading…"}
          </p>
        )}
      </Card>

      <Card className="px-5 py-4.5 sm:px-6">
        <h2 className="mb-3 text-[15px] font-bold">Recent orders</h2>
        <ul>
          {state.orders.slice(0, 4).map((o) => (
            <li
              key={o.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-zup-body/5 py-3 last:border-0"
            >
              <span className="w-20 text-sm font-bold">{o.id}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-zup-mid">{o.customer}</span>
              <span className="text-sm font-bold">{taka(o.total)}</span>
              <Pill tone={orderStatusTone(o.status)}>{o.status}</Pill>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
