"use client";

import { cn } from "@/lib/utils";
import { compactBd } from "@/lib/admin";

/*
 * Dependency-free charts matching the ZUP Admin design.
 * Text (values, axis labels, tooltips) is rendered as HTML so it never
 * distorts; only the plot geometry lives in stretched SVG, with
 * non-scaling strokes.
 */

export function BarChart({
  values,
  labels,
  format = (n) => `৳ ${n.toLocaleString("en-IN")}`,
  highlightMax = true,
}: {
  values: number[];
  labels: string[];
  format?: (n: number) => string;
  highlightMax?: boolean;
}) {
  const max = Math.max(...values, 1);
  const maxIdx = values.indexOf(Math.max(...values));
  return (
    <div>
      <div className="flex h-[180px] items-stretch gap-1.5 sm:h-[210px] sm:gap-2">
        {values.map((v, i) => {
          const hot = highlightMax && i === maxIdx;
          return (
            <div
              key={i}
              title={`${labels[i]} — ${format(v)}`}
              className="group flex min-w-0 flex-1 cursor-default flex-col items-center justify-end"
            >
              <span
                className={cn(
                  "mb-1 truncate text-[10px] font-bold sm:text-[11px]",
                  hot ? "text-zup-orange" : "text-zup-soft",
                  hot ? "block" : "hidden sm:block",
                )}
              >
                {compactBd(v)}
              </span>
              <div
                style={{ height: `calc((100% - 20px) * ${(v / max).toFixed(4)})` }}
                className={cn(
                  "w-full max-w-8 rounded-t-md rounded-b-[3px] transition-opacity group-hover:opacity-80",
                  hot ? "bg-zup-orange" : "bg-[#4d7ce8]",
                )}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5 border-t border-zup-body/8 pt-1.5 sm:gap-2">
        {labels.map((l, i) => (
          <span
            key={i}
            className={cn(
              "min-w-0 flex-1 truncate text-center text-[9px] text-zup-faint sm:text-[10px]",
              // On phones, an every-other-label rhythm keeps 14 columns readable
              i % 2 !== 0 && i !== labels.length - 1 && "invisible sm:visible",
            )}
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ===== Line / Area / Grouped-bars comparison chart ===== */

function pathFor(values: number[], max: number): string {
  const n = values.length;
  return values
    .map((v, i) => {
      const x = (i / (n - 1)) * 100;
      const y = 4 + (1 - v / max) * 92;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function LineChart({
  current,
  previous,
  labels,
  mode = "line",
  format = (n) => `৳ ${n.toLocaleString("en-IN")}`,
}: {
  current: number[];
  previous?: number[];
  labels: string[];
  mode?: "line" | "area" | "bars";
  format?: (n: number) => string;
}) {
  const max = Math.max(...current, ...(previous ?? []), 1);
  const n = current.length;

  return (
    <div>
      <div className="relative h-[190px] sm:h-[230px]">
        {/* gridlines */}
        <div className="absolute inset-x-0 top-1/2 border-t border-zup-body/5" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 border-t border-zup-body/10" aria-hidden />
        <span className="absolute -left-1 bottom-0 -translate-x-full text-[10px] text-zup-faint">
          0
        </span>

        {mode === "bars" ? (
          <div className="absolute inset-0 flex items-stretch gap-1 sm:gap-1.5">
            {current.map((v, i) => (
              <div key={i} className="flex min-w-0 flex-1 items-end justify-center gap-[2px]">
                <div
                  style={{ height: `${((v / max) * 96).toFixed(2)}%` }}
                  className="w-full max-w-5 rounded-t-[4px] bg-[#4d7ce8]"
                />
                {previous ? (
                  <div
                    style={{ height: `${((previous[i] / max) * 96).toFixed(2)}%` }}
                    className="w-full max-w-5 rounded-t-[4px] bg-zup-body/15"
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            {mode === "area" ? (
              <path
                d={`${pathFor(current, max)} L100,100 L0,100 Z`}
                className="fill-zup-blue/15"
              />
            ) : null}
            {previous ? (
              <path
                d={pathFor(previous, max)}
                fill="none"
                className="stroke-zup-soft"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
              />
            ) : null}
            <path
              d={pathFor(current, max)}
              fill="none"
              className="stroke-zup-blue"
              strokeWidth={2.4}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}

        {/* hover hit-areas + tooltips (screen-reader table below) */}
        <div className="absolute inset-0 flex" aria-hidden>
          {current.map((v, i) => (
            <div key={i} className="group relative min-w-0 flex-1 cursor-default">
              <div className="absolute inset-y-0 left-1/2 hidden w-px bg-zup-body/15 group-hover:block" />
              <div className="pointer-events-none absolute left-1/2 top-1 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-zup-ink px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg group-hover:block">
                <span className="mr-1 text-white/55">{labels[i]}</span>
                {format(v)}
                {previous ? (
                  <span className="ml-1.5 text-white/55">vs {format(previous[i])}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative mt-1.5 h-4">
        {labels.map((l, i) => (
          <span
            key={i}
            style={{
              left: `${(i / (n - 1)) * 100}%`,
              transform:
                i === 0 ? "none" : i === n - 1 ? "translateX(-100%)" : "translateX(-50%)",
            }}
            className={cn(
              "absolute top-0 text-[10px] text-zup-faint",
              // thin out crowded month labels on phones
              n > 8 && i % 2 !== 0 && i !== n - 1 && "hidden sm:inline",
            )}
          >
            {l}
          </span>
        ))}
      </div>

      {/* accessible alternative */}
      <table className="sr-only">
        <caption>Chart data</caption>
        <thead>
          <tr>
            <th>Period</th>
            <th>This period</th>
            {previous ? <th>Previous</th> : null}
          </tr>
        </thead>
        <tbody>
          {current.map((v, i) => (
            <tr key={i}>
              <td>{labels[i]}</td>
              <td>{format(v)}</td>
              {previous ? <td>{format(previous[i])}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ===== Donut ===== */

const DONUT_COLORS = ["#0b4fe0", "#e85320", "#1fa855", "#6B46C1", "#B7791F"];

export function Donut({
  segments,
}: {
  segments: { label: string; pct: number }[];
}) {
  const R = 15.915; // circumference = 100
  const offsets: number[] = [];
  for (let i = 0, acc = 25; i < segments.length; i++) {
    offsets.push(acc);
    acc -= segments[i].pct;
  }
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 42 42" className="h-28 w-28 shrink-0" role="img" aria-label="Revenue share by category">
        {segments.map((s, i) => (
          <circle
            key={s.label}
            cx="21"
            cy="21"
            r={R}
            fill="none"
            stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
            strokeWidth="7"
            strokeDasharray={`${s.pct} ${100 - s.pct}`}
            strokeDashoffset={offsets[i]}
          >
            <title>{`${s.label}: ${s.pct}%`}</title>
          </circle>
        ))}
      </svg>
      <ul className="flex min-w-0 flex-1 flex-col gap-2.5">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2.5 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            <span className="truncate text-zup-mid">{s.label}</span>
            <span className="ml-auto pl-4 font-bold text-zup-body">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
