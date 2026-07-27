"use client";

import type { LucideIcon } from "lucide-react";
import type { LocationNode } from "@/lib/locations";

/** One level of a Division→…→leaf cascade — shared by checkout and the
 *  account profile so both drive the same live /api/locations tree. */
export function LocationSelect({
  level,
  icon: Icon,
  onSelect,
}: {
  level: { label: string; options: LocationNode[]; selected: LocationNode | null };
  icon: LucideIcon;
  onSelect: (node: LocationNode) => void;
}) {
  const id = `loc-${level.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const loading = level.options.length === 0 && !level.selected;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-semibold text-zup-mid">
        {level.label}
      </label>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zup-soft"
          strokeWidth={1.8}
          aria-hidden
        />
        <select
          id={id}
          value={level.selected?.id ?? ""}
          disabled={loading}
          onChange={(e) => {
            const node = level.options.find((o) => o.id === e.target.value);
            if (node) onSelect(node);
          }}
          className="w-full cursor-pointer appearance-none rounded-2xl border border-zup-body/10 bg-white py-3.5 pr-3 pl-11.5 text-base outline-none transition-[border-color,box-shadow] duration-200 focus:border-zup-blue focus:ring-4 focus:ring-zup-blue/12 disabled:cursor-wait disabled:opacity-60"
        >
          {loading && <option value="">Loading…</option>}
          {level.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
