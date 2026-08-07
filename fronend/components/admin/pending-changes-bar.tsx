"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAdmin } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * The Save bar.
 *
 * Everything on the Rule-A screens (products, stock, staff, payments, orders,
 * website copy…) now stages its changes instead of writing them. This is the
 * only thing that sends them. It used to be a 700 ms debounce after each
 * keystroke, which PUT half-typed API secrets and fired a request per
 * character while someone renamed a role.
 *
 * Hidden when nothing is staged, so it costs no space on a clean screen.
 */
export function PendingChangesBar() {
  const { pending, commit, reset, sync } = useAdmin();
  const [saving, setSaving] = useState(false);
  // Also read the engine's own state: a save started from elsewhere (or one
  // still finishing) must disable this button too, or clicks queue up behind a
  // request that is already in flight.
  const busy = saving || sync.state === "saving";

  if (pending === 0) return null;

  const save = async () => {
    setSaving(true);
    try {
      await commit();
    } finally {
      setSaving(false);
    }
  };

  const failed = sync.state === "error";

  return (
    <div className="sticky bottom-0 z-30 mt-6 -mx-4 border-t border-zup-body/10 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ui-sm font-bold text-zup-body">
            {pending} unsaved {pending === 1 ? "change" : "changes"}
          </p>
          <p className="mt-0.5 text-ui-micro text-zup-gray">
            {failed
              ? (sync.error ?? "Couldn't save — try again.")
              : busy
                ? "Saving…"
                : "Nothing is sent until you save."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Discard throws work away, so it asks first — unlike Save, which
              only does what the button says. */}
          <ConfirmDialog
            trigger={
              <Button variant="secondary" size="lg" className="rounded-full" disabled={busy}>
                Discard
              </Button>
            }
            title={`Discard ${pending} unsaved ${pending === 1 ? "change" : "changes"}?`}
            description="The screen goes back to what the server has. This can't be undone."
            confirmLabel="Discard"
            onConfirm={() => {
              reset();
              toast("Changes discarded");
            }}
          />
          <Button size="xl" className="rounded-full" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : failed ? "Try again" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
