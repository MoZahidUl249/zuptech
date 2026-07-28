"use client";

import { useCallback, useEffect, useState } from "react";
import type { Warranty, WarrantyStatus } from "@/lib/admin";
import { req } from "@/lib/admin-http";

/*
 * Typed client for /admin/api/warranties. Kept out of the AdminState diff-sync
 * engine for the same reason as invoices (lib/admin-invoices.ts): server-derived
 * fields (endsAt) and 4xx-able transitions don't fit a debounced whole-object
 * diff.
 */


export const getWarranties = () => req<Warranty[]>("GET", "/admin/api/warranties");

/**
 * Backfill the registry for one delivered order. Delivery generates warranties
 * automatically; this covers orders delivered before the registry existed and
 * is safe to call repeatedly.
 */
export const generateWarranties = (orderId: string) =>
  req<{ created: number; warranties: Warranty[] }>("POST", "/admin/api/warranties", {
    orderId,
  });

export const patchWarranty = (
  id: string,
  patch: { serialNo?: string; status?: WarrantyStatus; claimNote?: string; months?: number },
) => req<Warranty>("PATCH", `/admin/api/warranties/${encodeURIComponent(id)}`, patch);

/** Local-state owner for the warranty registry, mirroring useInvoices. */
export function useWarranties() {
  const [list, setList] = useState<Warranty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchList = useCallback(
    (signal?: AbortSignal) =>
      getWarranties()
        .then((data) => {
          if (signal?.aborted) return;
          setList(data);
          setError(false);
        })
        .catch(() => {
          if (!signal?.aborted) setError(true);
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        }),
    [],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchList(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchList]);

  const reload = useCallback(async () => {
    setLoading(true);
    await fetchList();
  }, [fetchList]);

  const replace = useCallback(
    (row: Warranty) => setList((prev) => prev.map((w) => (w.id === row.id ? row : w))),
    [],
  );

  return { list, setList, replace, loading, error, reload };
}

/** Cover ends within 60 days — worth flagging in the registry. */
export function isExpiringSoon(w: Warranty): boolean {
  if (w.status !== "Active") return false;
  const days = (new Date(w.endsAt).getTime() - Date.now()) / 86_400_000;
  return days > 0 && days <= 60;
}

export function isExpired(w: Warranty): boolean {
  return new Date(w.endsAt).getTime() < Date.now();
}
