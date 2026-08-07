"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { useAdmin } from "@/lib/admin";
import { cn } from "@/lib/utils";

/**
 * Tells the admin whether their edits have actually been saved.
 *
 * Almost every screen here autosaves on a 700ms debounce, but nothing said so.
 * The result was two "Save changes" buttons in Site content that only fired a
 * toast — a fake control invented to fill the gap this component leaves. With
 * a real indicator in the header, those buttons can go.
 */
export function SaveStatus({ className }: { className?: string }) {
  const { sync, retrySync } = useAdmin();
  // "All changes saved" is reassuring for a moment and clutter after that, so
  // it self-clears. Tracked as "which save am I still acknowledging?" rather
  // than a boolean, so the timer can be set without a setState-in-effect.
  const [ackedAt, setAckedAt] = useState<number | null>(null);
  const showSaved = sync.state === "saved" && sync.at !== null && sync.at !== ackedAt;

  useEffect(() => {
    if (!showSaved) return;
    const at = sync.at;
    const t = setTimeout(() => setAckedAt(at), 3000);
    return () => clearTimeout(t);
  }, [showSaved, sync.at]);

  if (sync.state === "error") {
    return (
      <div
        className={cn("flex items-center gap-2", className)}
        role="alert"
        aria-live="assertive"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
        <span className="text-ui-sm font-semibold text-destructive">
          Couldn&apos;t save
        </span>
        <button
          type="button"
          onClick={retrySync}
          className="cursor-pointer rounded-full border border-destructive/30 px-2.5 py-1 text-ui-xs font-bold text-destructive transition-colors hover:bg-destructive/10"
        >
          Try again
        </button>
      </div>
    );
  }

  // "pending" means staged, not in flight — the pending-changes bar already
  // says "N unsaved changes" and offers the Save button. Showing a spinner and
  // the word "Saving…" for the same state had the header contradicting the bar
  // while nothing at all was being sent.
  const busy = sync.state === "saving";
  if (!busy && !showSaved) return null;

  return (
    <p
      className={cn("flex items-center gap-1.5 text-ui-sm text-zup-gray", className)}
      aria-live="polite"
    >
      {busy ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Saving…
        </>
      ) : (
        <>
          <Check className="h-3.5 w-3.5 text-ok-fg" aria-hidden />
          All changes saved
        </>
      )}
    </p>
  );
}

/**
 * "Couldn't load X — Retry", shown over a working admin.
 *
 * Loading is per-collection now, so one broken or forbidden endpoint costs
 * that one section rather than blanking the entire panel.
 */
export function LoadErrorBanner() {
  const { loadErrors, reset } = useAdmin();
  const [dismissed, setDismissed] = useState(false);

  if (loadErrors.length === 0 || dismissed) return null;

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-warn-fg/25 bg-warn-bg px-4 py-3"
      role="status"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-warn-fg" aria-hidden />
      <p className="flex-1 text-ui-sm text-warn-fg">
        Couldn&apos;t load {loadErrors.map((e) => e.label).join(", ")}. Everything else
        is working.
      </p>
      <button
        type="button"
        onClick={reset}
        className="cursor-pointer rounded-full bg-warn-fg/12 px-3 py-1.5 text-ui-xs font-bold text-warn-fg transition-colors hover:bg-warn-fg/20"
      >
        Try again
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="cursor-pointer px-2 py-1.5 text-ui-xs font-bold text-warn-fg/70 transition-colors hover:text-warn-fg"
      >
        Dismiss
      </button>
    </div>
  );
}
