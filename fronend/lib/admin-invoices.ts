"use client";

import { useCallback, useEffect, useState } from "react";
import type { Invoice, InvoiceStatus } from "@/lib/admin";
import { unwrap } from "@/lib/admin-http";
import { api } from "@/lib/eden";

/*
 * Typed client for /admin/api/invoices. Deliberately NOT wired into the
 * AdminState diff-sync engine in lib/admin.tsx: that engine debounces a
 * whole-object diff and has no story for the 409s and server-stamped fields
 * (issuedAt, issuedBy) this resource has. Same reasoning as useServices and
 * useLandingPages — see their comments.
 *
 * All calls are same-origin relative paths; next.config.ts proxies them to the
 * backend so the better-auth staff cookie applies without any CORS dance.
 */


export const getInvoices = () => unwrap(api.admin.api.invoices.get(), "GET /admin/api/invoices");

export const getInvoice = (id: string) =>
  unwrap(api.admin.api.invoices({ id }).get(), "GET /admin/api/invoices/:id");

/** Raise a Draft invoice for an order. Rejects (409) if one already exists. */
export const createInvoice = (orderId: string, notes = "") =>
  unwrap(api.admin.api.invoices.post({ orderId, notes }), "POST /admin/api/invoices");

export const patchInvoice = (
  id: string,
  patch: { status?: InvoiceStatus; notes?: string },
) => unwrap(api.admin.api.invoices({ id }).patch(patch), "PATCH /admin/api/invoices/:id");

/** Local-state owner for the invoice list, mirroring useServices. */
export function useInvoices() {
  const [list, setList] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // No synchronous setState in the effect body, only inside .then/.catch, so
  // this is safe to call from the mount effect.
  const fetchList = useCallback(
    (signal?: AbortSignal) =>
      getInvoices()
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

  /** Patch one row in place — avoids a full refetch on every status change. */
  const replace = useCallback(
    (row: Invoice) => setList((prev) => prev.map((i) => (i.id === row.id ? row : i))),
    [],
  );

  return { list, setList, replace, loading, error, reload };
}
