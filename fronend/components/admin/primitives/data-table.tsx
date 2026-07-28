"use client";

import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The admin's table.
 *
 * Replaces the old `<Table head minWidth>`, whose `minWidth` of 900–1040px
 * lived inside an 880px column — so every table in the admin scrolled
 * sideways, permanently, and the rightmost column (usually Status, usually the
 * one you came to change) was always off-screen.
 *
 * Two ideas instead of a minimum width:
 *
 *   `priority` — 1 always shows, 2 drops below `sm`, 3 drops below `lg`. A
 *     narrow screen loses the least important columns rather than the last
 *     ones.
 *   Card fallback — under `sm` the table stops being a table and each row
 *     becomes a stacked card. Horizontal scrolling on a phone is not a layout,
 *     and this admin gets used on phones in a warehouse.
 */

export interface Column<T> {
  /** Stable key, also the sort key when `sortable`. */
  key: string;
  header: string;
  /** 1 = always visible, 2 = hidden under sm, 3 = hidden under lg. */
  priority?: 1 | 2 | 3;
  align?: "left" | "right";
  sortable?: boolean;
  /** Suppresses the label in the phone card layout (e.g. an actions column). */
  hideLabelOnCard?: boolean;
  cell: (row: T) => React.ReactNode;
}

export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

const priorityCls = (p: Column<unknown>["priority"]) =>
  p === 3 ? "hidden lg:table-cell" : p === 2 ? "hidden sm:table-cell" : "";

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  sort,
  onSortChange,
  onRowActivate,
  empty,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  sort?: SortState | null;
  onSortChange?: (sort: SortState) => void;
  /** Makes rows clickable. Rendered as a real link/button, never `<tr onClick>`. */
  onRowActivate?: (row: T) => void;
  /** Shown instead of the table body when there are no rows. */
  empty?: React.ReactNode;
  className?: string;
}) {
  const toggleSort = (key: string) => {
    if (!onSortChange) return;
    onSortChange(
      sort?.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  };

  if (rows.length === 0 && empty) {
    return <div className={className}>{empty}</div>;
  }

  return (
    <div className={className}>
      {/* Table, sm and up */}
      <table className="hidden w-full text-left text-ui-sm [font-variant-numeric:tabular-nums] sm:table">
        <thead>
          <tr className="bg-surface-head">
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ChevronUp : ChevronDown;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={
                    active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined
                  }
                  className={cn(
                    "px-4 py-3 text-ui-micro font-bold uppercase tracking-[0.08em] text-zup-gray first:rounded-l-lg first:pl-5 last:rounded-r-lg",
                    c.align === "right" && "text-right",
                    priorityCls(c.priority),
                  )}
                >
                  {c.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1 rounded outline-none transition-colors hover:text-zup-body focus-visible:ring-3 focus-visible:ring-ring/50",
                        active && "text-zup-body",
                      )}
                    >
                      {c.header}
                      <Icon className="h-3 w-3" aria-hidden />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cn(
                "last:[&>td]:border-0",
                onRowActivate && "transition-colors hover:bg-surface-sunken",
              )}
            >
              {columns.map((c, i) => (
                <td
                  key={c.key}
                  className={cn(
                    "border-b border-zup-body/5 px-4 py-3.5 first:pl-5",
                    c.align === "right" && "text-right",
                    priorityCls(c.priority),
                  )}
                >
                  {/* The first cell carries the row's activation, so the row is
                      reachable by keyboard — a <tr onClick> never is. */}
                  {i === 0 && onRowActivate ? (
                    <button
                      type="button"
                      onClick={() => onRowActivate(row)}
                      className="cursor-pointer rounded text-left outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {c.cell(row)}
                    </button>
                  ) : (
                    c.cell(row)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Cards, under sm */}
      <ul className="flex flex-col gap-2.5 sm:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className="rounded-2xl border border-zup-body/8 bg-white px-4 py-3.5"
          >
            <dl className="flex flex-col gap-2">
              {columns.map((c) => (
                <div key={c.key} className="flex items-start justify-between gap-3">
                  {c.hideLabelOnCard ? null : (
                    <dt className="text-ui-micro font-bold uppercase tracking-[0.08em] text-zup-gray">
                      {c.header}
                    </dt>
                  )}
                  <dd className={cn("text-ui-sm", c.hideLabelOnCard ? "w-full" : "text-right")}>
                    {c.cell(row)}
                  </dd>
                </div>
              ))}
            </dl>
            {onRowActivate ? (
              <button
                type="button"
                onClick={() => onRowActivate(row)}
                className="mt-3 w-full cursor-pointer rounded-full bg-secondary py-2 text-ui-sm font-bold text-zup-body"
              >
                Open
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Sorts a copy of `rows` by a column's comparable value. */
export function sortRows<T>(
  rows: T[],
  sort: SortState | null | undefined,
  value: (row: T, key: string) => string | number | null | undefined,
): T[] {
  if (!sort) return rows;
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = value(a, sort.key) ?? "";
    const bv = value(b, sort.key) ?? "";
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
  });
}
