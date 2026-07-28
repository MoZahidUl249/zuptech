"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Search plus filters, above a list.
 *
 * Filter bars in this admin used to be a flat row of five or six controls that
 * wrapped onto three lines the moment the window narrowed. Here the search box
 * always shows, and everything else collapses on small screens into a
 * "Filters" button with a count, opening a sheet — so the controls stay
 * reachable without eating half the screen before you've seen a single row.
 */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  activeCount = 0,
  onReset,
  children,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  /** How many filters (excluding search) are set — shown on the mobile button. */
  activeCount?: number;
  onReset?: () => void;
  /** The filter controls themselves. */
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.5">
      <label className="relative min-w-0 flex-1 sm:max-w-[380px]">
        <span className="sr-only">{searchPlaceholder}</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zup-soft"
          aria-hidden
        />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="min-h-11 w-full rounded-full border border-zup-body/10 bg-white pr-9 pl-10 text-base text-zup-body outline-none transition-[border-color,box-shadow] placeholder:text-zup-faint focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-ui-base"
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-zup-soft transition-colors hover:bg-zup-body/6 hover:text-zup-body"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </label>

      {children ? (
        <>
          {/* md and up: inline */}
          <div className="hidden flex-wrap items-center gap-2.5 md:flex">{children}</div>

          {/* below md: behind a button, so the list isn't pushed off-screen */}
          <Sheet>
            <SheetTrigger
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-zup-body/10 bg-white px-4 text-ui-sm font-bold text-zup-body transition-colors hover:bg-secondary md:hidden",
                activeCount > 0 && "border-zup-blue text-zup-blue",
              )}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              Filters
              {activeCount > 0 ? (
                <span className="rounded-full bg-zup-blue px-1.5 text-ui-micro font-extrabold text-white">
                  {activeCount}
                </span>
              ) : null}
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[80dvh] gap-0 p-5">
              <SheetTitle className="mb-4 text-ui-lg font-bold">Filters</SheetTitle>
              <div className="flex flex-col gap-3.5 [&>*]:w-full">{children}</div>
            </SheetContent>
          </Sheet>
        </>
      ) : null}

      {onReset && (search || activeCount > 0) ? (
        <button
          type="button"
          onClick={onReset}
          className="min-h-11 cursor-pointer px-2 text-ui-sm font-bold text-zup-blue transition-colors hover:text-zup-blue-dark"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

/**
 * The primary filter, as a row of buttons rather than a dropdown.
 *
 * A dropdown hides both the options and how many rows are behind each one. For
 * the one filter people reach for constantly — an order's stage, a lead's
 * status — showing the choices with their counts turns the common task into a
 * single click.
 */
export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="mb-4 flex flex-wrap items-center gap-1.5 rounded-full bg-zup-body/5 p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-ui-sm font-bold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
              active ? "bg-white text-zup-body shadow-sm" : "text-zup-gray hover:text-zup-body",
            )}
          >
            {o.label}
            {o.count !== undefined ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-ui-micro font-extrabold",
                  active ? "bg-zup-blue text-white" : "bg-zup-body/8 text-zup-gray",
                )}
              >
                {o.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
