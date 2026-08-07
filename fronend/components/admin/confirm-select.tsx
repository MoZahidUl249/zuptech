"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { BtnGhost, BtnPrimary, selectCls } from "./ui";

/**
 * A status dropdown that doesn't take effect until it's confirmed.
 *
 * The screens that own their own CRUD (invoices, warranties, the order detail
 * sheet) write straight to the server on `change`, so picking the wrong item in
 * a dropdown used to be an immediate, irreversible fact — marking an invoice
 * Paid, or voiding a warranty, with no step in between. Everything else in the
 * admin now stages its changes behind a Save button; this is the same promise
 * for controls that can't route through that engine.
 */
export function ConfirmSelect<T extends string>({
  value,
  options,
  disabled,
  label,
  confirmLabel = "Apply",
  onConfirm,
}: {
  value: T;
  options: readonly T[];
  disabled?: boolean;
  /** Names the control for screen readers, e.g. "Status of invoice INV-12". */
  label: string;
  confirmLabel?: string;
  onConfirm: (next: T) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<T>(value);
  const [busy, setBusy] = useState(false);

  // The row can change under us (a refetch, another edit); follow it while the
  // admin hasn't staged anything of their own.
  const [seen, setSeen] = useState<T>(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }

  const dirty = draft !== value;

  const apply = async () => {
    setBusy(true);
    try {
      await onConfirm(draft);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        value={draft}
        aria-label={label}
        disabled={disabled || busy}
        onChange={(e) => setDraft(e.target.value as T)}
        className={selectCls}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      {dirty ? (
        <>
          <BtnPrimary
            aria-label={`${confirmLabel} — ${label}`}
            disabled={busy}
            onClick={() => void apply()}
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            <span className="ml-1">{busy ? "Saving…" : confirmLabel}</span>
          </BtnPrimary>
          <BtnGhost aria-label={`Cancel — ${label}`} disabled={busy} onClick={() => setDraft(value)}>
            <X className="h-3.5 w-3.5" aria-hidden />
          </BtnGhost>
        </>
      ) : null}
    </span>
  );
}
