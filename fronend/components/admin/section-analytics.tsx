"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { bd, taka } from "@/lib/admin";
import { useAdminMetrics, type MetricsPeriod } from "@/lib/admin-api";
import { Card, Segmented } from "./ui";
import { LineChart, Donut } from "./charts";

type ChartMode = "line" | "area" | "bars";
type Metric = "revenue" | "orders" | "customers" | "aov";

const COMPARE_LABEL: Record<MetricsPeriod, string> = {
  week: "vs last week",
  month: "vs last month",
  year: "vs last year",
};

function pct(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

export function AnalyticsSection() {
  const [period, setPeriod] = useState<MetricsPeriod>("week");
  const [mode, setMode] = useState<ChartMode>("line");
  const [metric, setMetric] = useState<Metric>("revenue");

  // All series and totals come from GET /admin/api/metrics.
  const { data, error } = useAdminMetrics(period);
  const compareLabel = COMPARE_LABEL[period];

  if (!data) {
    return (
      <Card className="px-5 py-10 text-center text-ui-sm text-zup-gray">
        {error ? "Couldn't load analytics from the server." : "Loading analytics…"}
      </Card>
    );
  }

  const { series, totals, previousTotals, categorySplit } = data;

  const cards: { id: Metric; label: string; value: string; delta: number }[] = [
    {
      id: "revenue",
      label: "Revenue",
      value: taka(totals.revenue),
      delta: pct(totals.revenue, previousTotals.revenue),
    },
    {
      id: "orders",
      label: "Orders",
      value: String(totals.orders),
      delta: pct(totals.orders, previousTotals.orders),
    },
    {
      id: "customers",
      label: "New customers",
      value: String(totals.newCustomers),
      delta: pct(totals.newCustomers, previousTotals.newCustomers),
    },
    {
      id: "aov",
      label: "Avg order value",
      value: taka(totals.aov),
      delta: pct(totals.aov, previousTotals.aov),
    },
  ];

  const chartValues =
    metric === "revenue"
      ? series.revenue
      : metric === "orders"
        ? series.orders
        : metric === "customers"
          ? series.newCustomers
          : series.aov;

  const metricLabel = cards.find((c) => c.id === metric)?.label ?? "Revenue";
  const bestIdx = chartValues.indexOf(Math.max(...chartValues));

  const catTotal = Object.values(categorySplit).reduce((a, b) => a + b, 0);
  const catSegments = Object.entries(categorySplit).map(([label, value]) => ({
    label,
    pct: catTotal > 0 ? Math.round((value / catTotal) * 100) : 0,
  }));
  const topCat = catSegments.reduce(
    (best, s) => (s.pct > best.pct ? s : best),
    catSegments[0] ?? { label: "—", pct: 0 },
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          options={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
            { value: "year", label: "Year" },
          ]}
          value={period}
          onChange={setPeriod}
        />
        <Segmented
          options={[
            { value: "line", label: "Line" },
            { value: "area", label: "Area" },
            { value: "bars", label: "Bars" },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setMetric(c.id)}
            className={cn(
              "rounded-2xl border bg-white px-5 py-4.5 text-left shadow-[0_1px_2px_rgba(21,24,30,.04)] transition-colors",
              metric === c.id
                ? "border-zup-blue bg-info-tint"
                : "border-zup-body/6 hover:border-zup-body/15",
            )}
          >
            <p className="text-xs font-medium text-zup-gray">{c.label}</p>
            <p className="mt-1.5 text-ui-xl font-extrabold leading-none tracking-[-0.02em] sm:text-ui-2xl">
              {c.value}
            </p>
            <p
              className={cn(
                "mt-2 text-xs font-semibold",
                c.delta >= 0 ? "text-zup-green" : "text-destructive",
              )}
            >
              {c.delta >= 0 ? "▲" : "▼"} {c.delta >= 0 ? "+" : ""}
              {c.delta}% {compareLabel}
            </p>
          </button>
        ))}
      </div>

      <Card className="px-5 py-4.5 sm:px-6">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-ui-base font-bold">
            {metricLabel} · this {period}
          </h2>
          <span className="flex items-center gap-1.5 text-xs text-zup-gray">
            <span className="h-0.5 w-5 rounded bg-zup-blue" /> This period
          </span>
        </div>
        <LineChart
          current={chartValues}
          labels={series.labels}
          mode={mode}
          format={metric === "revenue" || metric === "aov" ? taka : (n) => bd(n)}
        />
      </Card>

      <div className="grid gap-5 lg:grid-cols-[2fr_2.2fr]">
        <Card className="px-5 py-4.5 sm:px-6">
          <h2 className="mb-4 text-ui-base font-bold">Revenue by category</h2>
          <Donut segments={catSegments} />
        </Card>
        <Card className="px-5 py-4.5 sm:px-6">
          <h2 className="mb-3 text-ui-base font-bold">Detailed analysis</h2>
          <ul className="flex flex-col gap-2.5 text-sm leading-relaxed text-zup-mid">
            <Bullet>
              Revenue is {totals.revenue >= previousTotals.revenue ? "up" : "down"}{" "}
              {Math.abs(pct(totals.revenue, previousTotals.revenue))}% {compareLabel} (৳{" "}
              {bd(totals.revenue)} vs ৳ {bd(previousTotals.revenue)}).
            </Bullet>
            <Bullet>
              Best {period === "year" ? "month" : "day"}:{" "}
              {series.labels[bestIdx] ?? "—"} with{" "}
              {metric === "revenue" || metric === "aov"
                ? `৳ ${bd(Math.max(...chartValues, 0))}`
                : bd(Math.max(...chartValues, 0))}
              .
            </Bullet>
            <Bullet>
              {topCat.label} drives {topCat.pct}% of revenue this {period}.
            </Bullet>
            <Bullet>
              {totals.orders} orders from {totals.newCustomers} new customers — average
              order value {taka(totals.aov)}.
            </Bullet>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zup-blue" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
