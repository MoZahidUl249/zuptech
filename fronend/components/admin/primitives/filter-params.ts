"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * List filters, stored in the URL rather than in component state.
 *
 * This is what makes Today's one-click actions work: "4 delivered orders have
 * no bill yet" can link to /admin/bills?needsBill=1 and land on a screen
 * that's already filtered. It also means a filtered view can be bookmarked,
 * shared with a colleague, and survive a refresh — none of which was possible
 * when every screen kept its filters in `useState`.
 *
 * `replace` rather than `push`, so typing in a search box doesn't bury the
 * previous screen under a hundred history entries; `scroll: false` so the page
 * doesn't jump to the top on every keystroke.
 *
 * Any component calling this needs a <Suspense> boundary above it — Next
 * requires one around useSearchParams.
 */
export function useFilterParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const get = useCallback((key: string, fallback = "") => params.get(key) ?? fallback, [params]);

  /** Set several keys at once. `null` or "" removes a key rather than
   *  leaving `?status=` litter in the URL. */
  const set = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const clear = useCallback(() => router.replace(pathname, { scroll: false }), [pathname, router]);

  /** True when anything is filtered — drives the "Reset" button's visibility. */
  const active = params.toString().length > 0;

  return { get, set, clear, active };
}
