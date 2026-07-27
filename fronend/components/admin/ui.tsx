"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* Shared admin primitives, styled after ZUP Admin.dc.html */

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zup-body/6 bg-white shadow-[0_1px_2px_rgba(21,24,30,.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  note,
  tone = "muted",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "green" | "red" | "amber" | "muted";
}) {
  const tones = {
    green: "text-zup-green",
    red: "text-[#D32F2F]",
    amber: "text-[#B7791F]",
    muted: "text-zup-gray",
  } as const;
  return (
    <Card className="px-5 py-4.5">
      <p className="text-xs font-medium text-zup-gray">{label}</p>
      <p className="mt-1.5 text-[26px] font-extrabold leading-none tracking-[-0.02em] text-zup-body [font-variant-numeric:tabular-nums]">
        {value}
      </p>
      {note ? (
        <p className={cn("mt-2 text-xs font-semibold", tones[tone])}>{note}</p>
      ) : null}
    </Card>
  );
}

const PILL_TONES = {
  green: "bg-[#E6F4EA] text-[#2E7D32]",
  blue: "bg-[#E7EDFC] text-zup-blue",
  amber: "bg-[#FDF3DC] text-[#B7791F]",
  purple: "bg-[#EFEAFB] text-[#6B46C1]",
  red: "bg-[#FDE9E7] text-[#D32F2F]",
  gray: "bg-zup-body/6 text-zup-gray",
} as const;
export type PillTone = keyof typeof PILL_TONES;

export function Pill({
  tone,
  children,
  className,
}: {
  tone: PillTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold",
        PILL_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function orderStatusTone(status: string): PillTone {
  switch (status) {
    case "Processing":
      return "amber";
    case "Confirmed":
      return "blue";
    case "On the way":
      return "purple";
    case "Delivered":
      return "green";
    case "Cancelled":
      return "red";
    default:
      return "gray";
  }
}

export function invoiceStatusTone(status: string): PillTone {
  switch (status) {
    case "Draft":
      return "gray";
    case "Issued":
      return "blue";
    case "Paid":
      return "green";
    case "Void":
      return "red";
    default:
      return "gray";
  }
}

export function warrantyStatusTone(status: string): PillTone {
  switch (status) {
    case "Active":
      return "green";
    case "Claimed":
      return "amber";
    case "Replaced":
      return "purple";
    case "Expired":
      return "gray";
    case "Void":
      return "red";
    default:
      return "gray";
  }
}

export const inputCls =
  "min-h-10 w-full rounded-xl border border-zup-body/10 bg-white px-3.5 py-2 text-base text-zup-body outline-none transition-colors placeholder:text-zup-faint focus:border-zup-blue disabled:cursor-not-allowed disabled:bg-zup-body/3 disabled:text-zup-gray sm:text-sm";

export const selectCls =
  "min-h-10 rounded-xl border border-zup-body/10 bg-white px-3 py-2 text-base font-medium text-zup-body outline-none transition-colors focus:border-zup-blue disabled:cursor-not-allowed disabled:bg-zup-body/3 disabled:text-zup-gray sm:text-sm";

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-semibold text-zup-gray">{label}</span>
      {children}
    </label>
  );
}

export function BtnPrimary({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-zup-blue px-5 text-sm font-bold text-white transition-colors hover:bg-zup-blue-dark disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
    />
  );
}

export function BtnDark({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-full bg-zup-ink px-5 text-sm font-bold text-white transition-colors hover:bg-zup-body disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
    />
  );
}

export function BtnGhost({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-8 items-center justify-center rounded-full bg-secondary px-3.5 text-[13px] font-bold text-zup-body transition-colors hover:bg-zup-body/10 disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
    />
  );
}

export function BtnDanger({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-8 items-center justify-center rounded-full bg-[#FDE9E7] px-3.5 text-[13px] font-bold text-[#D32F2F] transition-colors hover:bg-[#FBD9D5] disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
    />
  );
}

export function Toggle({
  on,
  onChange,
  disabled,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-6.5 w-11.5 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        on ? "bg-zup-blue" : "bg-zup-body/20",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5.5 w-5.5 rounded-full bg-white shadow transition-[left]",
          on ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
  size = "md",
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-full bg-zup-body/6 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full font-bold transition-colors disabled:cursor-not-allowed",
            size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-[13px]",
            o.value === value
              ? "bg-zup-ink text-white"
              : "text-zup-gray hover:text-zup-body disabled:opacity-60",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Table({
  head,
  children,
  minWidth = 640,
}: {
  head: string[];
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table
        className="w-full text-left text-sm [font-variant-numeric:tabular-nums]"
        style={{ minWidth }}
      >
        <thead>
          <tr className="bg-[#F7F8FA]">
            {head.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-zup-gray first:rounded-l-lg first:pl-5 last:rounded-r-lg"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({
  className,
  children,
  colSpan,
}: {
  className?: string;
  children?: React.ReactNode;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn("border-b border-zup-body/5 px-4 py-3.5 first:pl-5", className)}
    >
      {children}
    </td>
  );
}

export function TagsInput({
  tags,
  onChange,
  placeholder = "Add a tag, press Enter…",
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const t = draft.trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setDraft("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-zup-body/12 bg-white px-3 py-2 transition-colors focus-within:border-zup-blue">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full bg-secondary py-1 pr-1.5 pl-2.5 text-xs font-semibold text-zup-body"
        >
          {t}
          <button
            type="button"
            onClick={() => onChange(tags.filter((x) => x !== t))}
            aria-label={`Remove tag ${t}`}
            className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-zup-faint hover:bg-zup-body/10 hover:text-zup-red"
          >
            <X className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && tags.length > 0) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={tags.length ? "Add another…" : placeholder}
        aria-label="Add tag"
        className="min-w-28 flex-1 border-0 bg-transparent py-0.5 text-sm outline-none placeholder:text-zup-faint"
      />
    </div>
  );
}
