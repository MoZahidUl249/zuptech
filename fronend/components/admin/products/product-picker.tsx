"use client";

import { toast } from "sonner";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useAdmin, type AdminProduct } from "@/lib/admin";
import { BtnGhost, selectCls } from "@/components/admin/ui";

/**
 * An ordered list of products, picked from the catalogue.
 *
 * Three screens need exactly this control and the order always matters: the
 * home page's featured row, its second row, and a product's own
 * recommendations. It started as `FeaturedRowEditor` on the content screen and
 * was lifted here rather than copied twice — the fiddly parts are the same
 * every time. Specifically:
 *
 *   - ids are resolved against the live catalogue and any that no longer
 *     resolve are dropped from the rendering. A deleted or unpublished product
 *     should cost one row, not a crash or a blank entry nobody can remove.
 *   - the add control stays on its placeholder after each pick, so several
 *     products can be added without resetting it between each one.
 *   - a hidden product is still listed, and labelled as hidden. It is a
 *     legitimate thing to queue up before publishing, and silently omitting it
 *     looks like the picker is broken.
 *
 * Storage is the caller's business: `ids`/`onChange` in, no writes of its own.
 * That is what lets the same component sit over a SiteConfig column on one
 * screen and a Product column on another.
 */
export function ProductPicker({
  ids,
  onChange,
  label,
  addLabel,
  emptyNote,
  readOnly,
  excludeId,
  selectId,
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
  /** Used in toasts and aria-labels: "removed from {label}". */
  label: string;
  addLabel?: string;
  emptyNote: string;
  readOnly?: boolean;
  /** Keep a product out of its own list. */
  excludeId?: string;
  /** Distinct id for the <select>, since a screen may host two of these. */
  selectId: string;
}) {
  const { state } = useAdmin();

  const chosen = ids
    .map((id) => state.products.find((p) => p.id === id))
    .filter((p): p is AdminProduct => Boolean(p));

  const available = state.products
    .filter((p) => !ids.includes(p.id) && p.id !== excludeId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const move = (index: number, dir: -1 | 1) => {
    const next = [...ids];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  return (
    <>
      {chosen.length === 0 ? (
        <p className="mt-4 text-ui-sm text-zup-soft">{emptyNote}</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-2">
          {chosen.map((p, i) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-zup-body/8 px-3.5 py-2.5"
            >
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-zup-body/6 text-ui-xs font-bold text-zup-gray">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ui-base font-bold">{p.name}</span>
                <span className="block text-ui-micro text-zup-soft">
                  {p.category || "—"}
                  {p.visible ? "" : " · hidden from the storefront"}
                </span>
              </span>
              {readOnly ? null : (
                <span className="flex items-center gap-1">
                  <BtnGhost
                    aria-label={`Move ${p.name} earlier`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                  </BtnGhost>
                  <BtnGhost
                    aria-label={`Move ${p.name} later`}
                    disabled={i === chosen.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                  </BtnGhost>
                  <BtnGhost
                    aria-label={`Remove ${p.name} from ${label}`}
                    onClick={() => {
                      onChange(ids.filter((id) => id !== p.id));
                      toast(`${p.name} removed from ${label}`);
                    }}
                  >
                    <X className="h-3.5 w-3.5 text-destructive" aria-hidden />
                  </BtnGhost>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {readOnly ? null : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label htmlFor={selectId} className="text-ui-sm font-semibold text-zup-gray">
            {addLabel ?? "Add a product"}
          </label>
          <select
            id={selectId}
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              const picked = state.products.find((p) => p.id === e.target.value);
              onChange([...ids, e.target.value]);
              if (picked) toast(`${picked.name} added to ${label}`);
            }}
            className={selectCls}
          >
            <option value="">Select…</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.visible ? "" : " (hidden)"}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
