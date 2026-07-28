"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * Shared admin primitives.
 *
 * These delegate to the shadcn components in components/ui/ rather than
 * hand-rolling their own buttons and inputs. The admin used to carry a
 * complete parallel design system here, which is why Landing pages — the one
 * screen built on shadcn — looked like a different product.
 *
 * Colours and type sizes come from the `--color-*` / `--text-ui-*` tokens in
 * app/globals.css — no hex literals and no arbitrary pixel type sizes.
 *
 * Every export keeps the name and props it always had, so all 19 admin files
 * kept compiling through the swap. Anything marked @deprecated has a better
 * replacement in ./primitives and should stop being used in new code.
 */

export function Card({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
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
    red: "text-destructive",
    amber: "text-warn-fg",
    muted: "text-zup-gray",
  } as const;
  return (
    <Card className="px-5 py-4.5">
      <p className="text-ui-xs font-medium text-zup-gray">{label}</p>
      <p className="mt-1.5 text-ui-2xl font-extrabold tracking-[-0.02em] text-zup-body [font-variant-numeric:tabular-nums]">
        {value}
      </p>
      {note ? (
        <p className={cn("mt-2 text-ui-xs font-semibold", tones[tone])}>{note}</p>
      ) : null}
    </Card>
  );
}

const PILL_TONES = {
  green: "bg-ok-bg text-ok-fg",
  blue: "bg-info-bg text-info-fg",
  amber: "bg-warn-bg text-warn-fg",
  purple: "bg-note-bg text-note-fg",
  red: "bg-destructive/10 text-destructive",
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
        "inline-flex items-center rounded-full px-3 py-1 text-ui-xs font-bold",
        PILL_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* The three status→tone maps below are domain knowledge, not styling. They
 * predate the token system and are deliberately unchanged. */

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

/* Field styling is exported as class strings rather than components because
 * ~60 call sites spread them onto their own <input>/<select>. The focus ring
 * matches shadcn's so a form mixing the two looks like one form.
 * The `text-base` → `sm:text-ui-base` step keeps mobile at 16px; anything
 * smaller makes iOS zoom the page on focus. */

export const inputCls =
  "min-h-11 w-full rounded-xl border border-zup-body/10 bg-white px-3.5 py-2 text-base text-zup-body outline-none transition-[border-color,box-shadow] placeholder:text-zup-faint focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-zup-body/3 disabled:text-zup-gray sm:text-ui-base";

export const selectCls =
  "min-h-11 rounded-xl border border-zup-body/10 bg-white px-3 py-2 text-base font-medium text-zup-body outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-zup-body/3 disabled:text-zup-gray sm:text-ui-base";

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
      <span className="text-ui-xs font-semibold text-zup-gray">{label}</span>
      {children}
    </label>
  );
}

/* The four button wrappers below are shadcn <Button> with a variant and a
 * pill radius pinned. They exist only so ~200 existing call sites keep
 * working; new code should use <Button variant=… size="xl"> directly. */

type BtnProps = React.ComponentProps<typeof Button>;

/** @deprecated Use `<Button size="xl" className="rounded-full">`. */
export function BtnPrimary({ className, ...props }: BtnProps) {
  return (
    <Button
      size="xl"
      {...props}
      className={cn("rounded-full font-bold disabled:opacity-45", className)}
    />
  );
}

/** @deprecated Use `<Button variant="dark" size="xl" className="rounded-full">`. */
export function BtnDark({ className, ...props }: BtnProps) {
  return (
    <Button
      variant="dark"
      size="xl"
      {...props}
      className={cn("rounded-full font-bold disabled:opacity-45", className)}
    />
  );
}

/** @deprecated Use `<Button variant="secondary" size="lg" className="rounded-full">`. */
export function BtnGhost({ className, ...props }: BtnProps) {
  return (
    <Button
      variant="secondary"
      size="lg"
      {...props}
      className={cn(
        "rounded-full text-ui-sm font-bold text-zup-body disabled:opacity-45",
        className,
      )}
    />
  );
}

/** @deprecated Use `<Button variant="destructive" size="lg" className="rounded-full">`. */
export function BtnDanger({ className, ...props }: BtnProps) {
  return (
    <Button
      variant="destructive"
      size="lg"
      {...props}
      className={cn("rounded-full text-ui-sm font-bold disabled:opacity-45", className)}
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
        "relative h-6.5 w-11.5 shrink-0 cursor-pointer rounded-full outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-45",
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
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  /** Names the group for screen readers. */
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // A segmented control is a radio group, not a row of toggle buttons. It used
  // to announce itself as loose `aria-pressed` buttons and had no keyboard
  // story at all; now it behaves like the native radio group it imitates —
  // one tab stop, arrows to move between options.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir || disabled) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + dir + options.length) % options.length];
    onChange(next.value);
    // Follow focus, as a real radio group does.
    const btns = ref.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    btns?.[options.indexOf(next)]?.focus();
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="inline-flex rounded-full bg-zup-body/6 p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            // Roving tabindex: the group is one stop, arrows move within it.
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "cursor-pointer rounded-full font-bold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed",
              size === "sm" ? "px-3 py-1 text-ui-xs" : "px-4 py-1.5 text-ui-sm",
              active
                ? "bg-zup-ink text-white"
                : "text-zup-gray hover:text-zup-body disabled:opacity-60",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * @deprecated Prefer `DataTable` from ./primitives, which drops `minWidth` in
 * favour of per-column priorities and a stacked card layout on phones.
 */
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
        className="w-full text-left text-ui-sm [font-variant-numeric:tabular-nums]"
        style={{ minWidth }}
      >
        <thead>
          <tr className="bg-surface-head">
            {head.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-ui-micro font-bold uppercase tracking-[0.08em] text-zup-gray first:rounded-l-lg first:pl-5 last:rounded-r-lg"
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

/** @deprecated Paired with the deprecated `Table`. */
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
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-zup-body/12 bg-white px-3 py-2 transition-colors focus-within:border-ring">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full bg-secondary py-1 pr-1.5 pl-2.5 text-ui-xs font-semibold text-zup-body"
        >
          {t}
          <button
            type="button"
            onClick={() => onChange(tags.filter((x) => x !== t))}
            aria-label={`Remove tag ${t}`}
            className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-zup-faint hover:bg-zup-body/10 hover:text-destructive"
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
        className="min-w-28 flex-1 border-0 bg-transparent py-0.5 text-ui-base outline-none placeholder:text-zup-faint"
      />
    </div>
  );
}
