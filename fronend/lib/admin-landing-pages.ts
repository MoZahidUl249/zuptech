"use client";

import { useCallback, useEffect, useState } from "react";
import { req } from "@/lib/admin-http";

/** Row shape of GET /admin/api/landing-pages (LandingPageDto). */
export interface LandingPage {
  id: string;
  /** Internal admin name — never shown to visitors. */
  title: string;
  /** The public <h1>. "" falls back to the product name server-side. */
  headline: string;
  slug: string;
  productId: string;
  /** Resolved server-side for display. */
  productName: string;
  productSlug: string;
  /**
   * false = the product is off the storefront and this page is the only way
   * to buy it, so unpublishing here also closes checkout for it.
   */
  productVisible: boolean;
  /**
   * What checkout actually charges per unit. `offerPrice` is campaign copy —
   * the backend never prices from it — so the editor warns when they differ.
   */
  productSellingPrice: number;
  offerPrice: number;
  compareAtPrice: number;
  ribbonText: string;
  buttonLabel: string;
  footerNote: string;
  benefitBullets: string[];
  imageHint: string;
  gtmId: string;
  published: boolean;
  viewCount: number;
  orderCount: number;
  createdAt: string;
  updatedAt: string;
}

/*
 * Client for the Landing Pages admin module. Deliberately NOT wired into the
 * big AdminState diff-sync engine in lib/admin.tsx — that engine syncs a
 * whole-state diff on every change, and campaign pages want explicit
 * save/publish/duplicate actions with their own optimistic reload.
 *
 * Talks to the real backend (`/admin/api/landing-pages`, proxied by
 * next.config.ts). The former local mock under app/admin/api/landing-pages
 * and its in-memory store are gone — with them removed, the rewrite handles
 * these paths, so the clean REST shape below works as documented.
 */


export const listLandingPages = () => req<LandingPage[]>("GET", "/admin/api/landing-pages");

/** The writable subset — everything the server resolves or owns is stripped. */
export type LandingPageDraft = Omit<
  LandingPage,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "viewCount"
  | "orderCount"
  | "productName"
  | "productSlug"
  | "productVisible"
  | "productSellingPrice"
>;

export const createLandingPage = (draft: LandingPageDraft) =>
  req<LandingPage>("POST", "/admin/api/landing-pages", draft);

const at = (id: string) => `/admin/api/landing-pages/${encodeURIComponent(id)}`;

export const patchLandingPage = (id: string, patch: Partial<LandingPageDraft>) =>
  req<LandingPage>("PATCH", at(id), patch);

export const deleteLandingPage = (id: string) => req<{ ok: true }>("DELETE", at(id));

export const publishLandingPage = (id: string) =>
  req<LandingPage>("POST", `${at(id)}/publish`);

export const unpublishLandingPage = (id: string) =>
  req<LandingPage>("POST", `${at(id)}/unpublish`);

export const duplicateLandingPage = (id: string) =>
  req<LandingPage>("POST", `${at(id)}/duplicate`);

export function useLandingPages() {
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // No synchronous setState in the effect body itself (only inside the
  // .then/.catch below) — fetchList is safe to call directly from the
  // mount effect. `reload` (used from event handlers, e.g. after
  // save/publish/delete) is a separate function that's fine to set state
  // synchronously in, since it's never called from inside an effect.
  const fetchList = useCallback((signal?: AbortSignal) => {
    return listLandingPages()
      .then((data) => {
        if (signal?.aborted) return;
        setPages(data);
        setError(false);
      })
      .catch(() => {
        if (!signal?.aborted) setError(true);
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchList(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchList]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    await fetchList();
  }, [fetchList]);

  return { pages, loading, error, reload };
}
