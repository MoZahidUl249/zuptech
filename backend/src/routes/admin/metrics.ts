import { Elysia } from "elysia";
import { metricsQueryDto } from "../../dtos/metrics.dto";
import { prisma } from "../../lib/db";
import { assertCan } from "../../lib/rbac";
import { isLowStock } from "../../lib/rules";
import { staffGuard } from "./guard";

/**
 * Dashboard + analytics numbers (BACKEND.md §5). Everything is computed from
 * orders/customers/leads on the fly — fine at this catalog's scale; add
 * rollup tables if order volume ever makes this slow.
 *
 * Cancelled orders never count toward revenue or order totals.
 */

type Period = "week" | "month" | "year";

/** Start of the local day, `offset` days from today. */
function dayStart(offset = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

/** Start of the local month, `offset` months from this one. */
function monthStart(offset = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d;
}

/** Percentage change, guarding the divide-by-zero case. */
function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/** Bucket boundaries for a period: N buckets now + N before for comparison. */
function bucketsFor(period: Period): { starts: Date[]; label: (d: Date) => string } {
  if (period === "year") {
    const starts = Array.from({ length: 25 }, (_, i) => monthStart(i - 24));
    return { starts, label: (d) => d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }) };
  }
  const days = period === "week" ? 7 : 30;
  const starts = Array.from({ length: days * 2 + 1 }, (_, i) => dayStart(i - days * 2));
  return { starts, label: (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Add to a bucket, tolerating an out-of-range index instead of asserting. */
const addAt = (xs: number[], i: number, by: number) => {
  xs[i] = (xs[i] ?? 0) + by;
};

export const adminMetrics = new Elysia({ name: "routes/admin/metrics", detail: { tags: ["Admin · Metrics"] } })
  .use(staffGuard)

  .get(
    "/admin/api/metrics",
    async ({ query, staffCtx }) => {
      assertCan(staffCtx, "dashboard", "view");

      const period: Period = query.period ?? "week";
      const { starts, label } = bucketsFor(period);
      const bucketCount = (starts.length - 1) / 2; // previous half + current half
      const rangeStart = starts[0];
      if (!rangeStart) throw new Error(`bucketsFor("${period}") returned no buckets`);

      const [orders, customers, products, openLeads, leadsToday, openPoCount, sections] =
        await Promise.all([
          prisma.order.findMany({
            where: { createdAt: { gte: rangeStart }, status: { not: "Cancelled" } },
            include: {
              items: {
                include: {
                  product: { select: { category: { select: { section: { select: { name: true } } } } } },
                },
              },
            },
          }),
          prisma.customer.findMany({
            where: { joinedAt: { gte: rangeStart } },
            select: { joinedAt: true },
          }),
          prisma.product.findMany({ select: { stock: true, reserved: true, reorderAt: true } }),
          prisma.serviceLead.count({ where: { status: { notIn: ["Won", "Lost"] } } }),
          prisma.serviceLead.count({ where: { createdAt: { gte: dayStart(0) } } }),
          prisma.purchaseOrder.count({ where: { status: { in: ["Confirmed", "In transit"] } } }),
          prisma.section.findMany({ orderBy: { sort: "asc" }, select: { name: true } }),
        ]);

      // ---- bucket the range: [0..bucketCount) = previous, rest = current ----
      const revenue = new Array<number>(bucketCount * 2).fill(0);
      const orderCounts = new Array<number>(bucketCount * 2).fill(0);
      const newCustomers = new Array<number>(bucketCount * 2).fill(0);
      const bucketIndex = (at: Date) => {
        for (let i = starts.length - 2; i >= 0; i--) {
          const start = starts[i];
          if (start && at >= start) return i;
        }
        return -1;
      };

      // Keyed by section name, so adding a section to the catalog shows up
      // here without a code change. "Services" is not a section — service
      // revenue isn't invoiced through orders yet, so it stays 0 for now.
      const categorySplit: Record<string, number> = { Services: 0 };
      for (const s of sections) categorySplit[s.name] = 0;

      for (const order of orders) {
        const i = bucketIndex(order.createdAt);
        if (i < 0) continue;
        addAt(revenue, i, order.total);
        addAt(orderCounts, i, 1);
        if (i >= bucketCount) {
          // Section revenue split, current period only.
          for (const item of order.items) {
            const section = item.product.category.section.name;
            categorySplit[section] = (categorySplit[section] ?? 0) + item.unitPrice * item.qty;
          }
        }
      }
      for (const c of customers) {
        const i = bucketIndex(c.joinedAt);
        if (i >= 0) addAt(newCustomers, i, 1);
      }

      const current = {
        revenue: revenue.slice(bucketCount),
        orders: orderCounts.slice(bucketCount),
        newCustomers: newCustomers.slice(bucketCount),
      };
      const previous = {
        revenue: sum(revenue.slice(0, bucketCount)),
        orders: sum(orderCounts.slice(0, bucketCount)),
        newCustomers: sum(newCustomers.slice(0, bucketCount)),
      };
      const totals = {
        revenue: sum(current.revenue),
        orders: sum(current.orders),
        newCustomers: sum(current.newCustomers),
      };

      // ---- KPI cards (always week-based, whatever the series period) ----
      const weekAgo = dayStart(-6);
      const twoWeeksAgo = dayStart(-13);
      const thisWeek = orders.filter((o) => o.createdAt >= weekAgo);
      const lastWeek = orders.filter((o) => o.createdAt >= twoWeeksAgo && o.createdAt < weekAgo);
      const revThisWeek = sum(thisWeek.map((o) => o.total));
      const revLastWeek = sum(lastWeek.map((o) => o.total));

      // ---- revenue, last 14 days (daily bars) ----
      const revenue14d = Array.from({ length: 14 }, (_, i) => {
        const from = dayStart(i - 13);
        const to = dayStart(i - 12);
        const day = orders.filter((o) => o.createdAt >= from && o.createdAt < to);
        return { date: from.toISOString().slice(0, 10), revenue: sum(day.map((o) => o.total)) };
      });

      return {
        kpis: {
          ordersThisWeek: { value: thisWeek.length, pctChange: pctChange(thisWeek.length, lastWeek.length) },
          revenueThisWeek: { value: revThisWeek, pctChange: pctChange(revThisWeek, revLastWeek) },
          openLeads: { value: openLeads, newToday: leadsToday },
          lowStockCount: products.filter(isLowStock).length,
          openPoCount,
        },
        revenue14d,
        series: {
          period,
          labels: starts.slice(bucketCount, bucketCount * 2).map(label),
          revenue: current.revenue,
          orders: current.orders,
          newCustomers: current.newCustomers,
          aov: current.revenue.map((r, i) => {
            const orderCount = current.orders[i] ?? 0;
            return orderCount > 0 ? Math.round(r / orderCount) : 0;
          }),
        },
        totals: {
          ...totals,
          aov: totals.orders > 0 ? Math.round(totals.revenue / totals.orders) : 0,
        },
        previousTotals: {
          ...previous,
          aov: previous.orders > 0 ? Math.round(previous.revenue / previous.orders) : 0,
        },
        categorySplit,
      };
    },
    { query: metricsQueryDto },
  );
