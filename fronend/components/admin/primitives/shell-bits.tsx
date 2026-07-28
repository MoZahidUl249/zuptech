"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * The small, repeated pieces every admin screen needs: a page heading, an
 * empty state, and loading placeholders.
 *
 * All three existed only as ad-hoc markup before — every section wrote its own
 * "Loading…" string and its own grey one-liner for "no rows", so nothing quite
 * matched and none of it said anything useful.
 */

/** Screen title, one plain-language sentence, and the primary action. */
export function PageHeader({
  title,
  help,
  action,
  children,
}: {
  title: string;
  /** One sentence explaining what this screen is for, in plain words. */
  help?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-ui-xl font-extrabold tracking-[-0.015em]">{title}</h1>
        {help ? <p className="mt-1 text-ui-sm text-zup-gray">{help}</p> : null}
        {children}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}

/**
 * Nothing to show — and *why*, which matters. "No orders yet" and "none match
 * your filter" call for different next steps, so they get different actions.
 */
export function EmptyState({
  icon: Icon,
  title,
  help,
  action,
}: {
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  help?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zup-body/12 bg-white px-6 py-12 text-center">
      {Icon ? (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary">
          <Icon className="h-5 w-5 text-zup-soft" aria-hidden />
        </span>
      ) : null}
      <p className="text-ui-base font-bold text-zup-body">{title}</p>
      {help ? <p className="max-w-[38ch] text-ui-sm text-zup-gray">{help}</p> : null}
      {action}
    </div>
  );
}

/** Placeholder rows while a list loads. Replaces the bare "Loading…" text. */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col gap-2 px-2 py-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-3 py-2.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn("h-4", c === 0 ? "w-24" : c === cols - 1 ? "w-16" : "flex-1")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Placeholder for a card-shaped screen (payments, heroes, campaigns). */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border border-zup-body/6 bg-white px-5 py-4.5"
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-1/2" : "w-full")} />
      ))}
    </div>
  );
}

/**
 * Loading / failed / empty, in one place, so every Rule-B resource screen
 * behaves the same instead of each inventing its own three states.
 */
export function ResourceState({
  loading,
  error,
  onRetry,
  isEmpty,
  empty,
  skeleton,
  children,
}: {
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  empty?: React.ReactNode;
  skeleton?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (loading) return <>{skeleton ?? <TableSkeleton />}</>;
  if (error) {
    return (
      <EmptyState
        title="Couldn't load this"
        help={error}
        action={
          onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="cursor-pointer rounded-full bg-zup-ink px-4 py-2 text-ui-sm font-bold text-white transition-colors hover:bg-zup-body"
            >
              Try again
            </button>
          ) : undefined
        }
      />
    );
  }
  if (isEmpty && empty) return <>{empty}</>;
  return <>{children}</>;
}
