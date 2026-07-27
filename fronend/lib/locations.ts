"use client";

import { useEffect, useState } from "react";

/**
 * Client for the backend's address/pricing tree: Division -> District ->
 * (CityCorporation -> CityCorpArea) | (Upazila -> Union) | (Thana -> Ward).
 * A customer/order always points at a leaf (isLeaf true) — see BACKEND.md
 * and cal-bk.md for the full contract. Replaces the old flat district list
 * (admin-bridge's DEFAULT_DISTRICTS/BD_DIVISIONS) and the static
 * upazila/union data in lib/bd-geo.ts (kept only as the source this tree
 * was seeded from — see scripts note in that file).
 */
export interface LocationNode {
  id: string;
  type:
    | "DIVISION"
    | "DISTRICT"
    | "CITY_CORPORATION"
    | "UPAZILA"
    | "THANA"
    | "CITY_CORP_AREA"
    | "UNION"
    | "WARD";
  name: string;
  parentId: string | null;
  deliveryCost: number;
  installationCost: number;
  sort: number;
  isLeaf: boolean;
  hasChildren: boolean;
}

async function fetchChildren(parentId: string | null, admin: boolean): Promise<LocationNode[]> {
  const qs = parentId ? `?parentId=${encodeURIComponent(parentId)}` : "";
  const res = await fetch(`${admin ? "/admin/api" : "/api"}/locations${qs}`);
  if (!res.ok) throw new Error(`locations ${res.status}`);
  return res.json();
}

/** Root-to-node ancestor chain for a known leaf id, e.g. to re-derive a
 *  saved Division/District/.../leaf selection from a stored areaId. */
export async function fetchLocationPath(id: string): Promise<LocationNode[]> {
  const res = await fetch(`/api/locations/${encodeURIComponent(id)}/path`);
  if (!res.ok) throw new Error(`locations path ${res.status}`);
  return res.json();
}

/** parentId's own identity doubles as "have we fetched for this key yet" —
 *  avoids a synchronous reset-setState at the top of the effect (only
 *  library-required async fetches call setState, from inside their .then/
 *  .catch, matching this app's react-hooks/set-state-in-effect rule); a
 *  request for a *different* parentId than what's currently loaded is
 *  simply treated as stale at render time until its own fetch resolves. */
export function useLocationChildren(parentId: string | null | undefined, admin = false) {
  const [result, setResult] = useState<{ key: string; nodes: LocationNode[] | null; error: boolean } | null>(null);
  const key = parentId === undefined ? undefined : (parentId ?? "");

  useEffect(() => {
    if (key === undefined) return;
    let cancelled = false;
    fetchChildren(parentId ?? null, admin)
      .then((n) => {
        if (!cancelled) setResult({ key, nodes: n, error: false });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, nodes: null, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [key, parentId, admin]);

  return result && result.key === key
    ? { nodes: result.nodes, error: result.error }
    : { nodes: null, error: false };
}

/** The tree is always exactly 4 levels deep to a leaf: Division, District,
 *  Upazila|CityCorporation|Thana, then Union|CityCorpArea|Ward (leaf). */
export type LocationPath = [LocationNode | null, LocationNode | null, LocationNode | null, LocationNode | null];

const EMPTY_PATH: LocationPath = [null, null, null, null];

/**
 * Drives a 4-level Division -> ... -> leaf cascade against the live tree.
 * Selecting a node at level `i` clears everything below it; each level
 * auto-selects its first option once loaded and nothing is chosen yet
 * (mirrors the old static-data cascade's UX). Pass `initialLeafId` to
 * resolve an existing saved area (e.g. a customer's areaId) back into its
 * ancestor path on first load. `resetKey` forces a fresh resolve/reset
 * whenever it changes even if `initialLeafId` happens to be the same value
 * both times (e.g. two different signed-out-then-signed-in customers who
 * both have no saved area yet) — pass a stable per-identity value like a
 * customer id, mirroring the same-value-different-identity problem other
 * profile fields in this app already guard against.
 */
export function useLocationCascade(initialLeafId?: string | null, resetKey?: string) {
  const resolveKey = `${resetKey ?? ""}:${initialLeafId ?? ""}`;

  // Resolves a saved leaf id into its ancestor path; only ever setState from
  // inside the fetch's own callbacks, never synchronously in the effect
  // body. No id to resolve is handled entirely at render time below, not
  // here, so this effect has nothing to do (and nothing to setState) in
  // that case.
  const [resolved, setResolved] = useState<{ key: string; path: LocationPath } | null>(null);
  useEffect(() => {
    if (!initialLeafId) return;
    let cancelled = false;
    fetchLocationPath(initialLeafId)
      .then((ancestors) => {
        if (cancelled) return;
        const next: LocationPath = [...EMPTY_PATH];
        ancestors.forEach((n, i) => {
          if (i < 4) next[i] = n;
        });
        setResolved({ key: resolveKey, path: next });
      })
      .catch(() => {
        // Unknown/deleted area — fall back to a fresh cascade.
        if (!cancelled) setResolved({ key: resolveKey, path: EMPTY_PATH });
      });
    return () => {
      cancelled = true;
    };
  }, [resolveKey, initialLeafId]);

  const resolving = Boolean(initialLeafId) && resolved?.key !== resolveKey;
  const resolvedPath: LocationPath = !resolving && resolved?.key === resolveKey ? resolved.path : EMPTY_PATH;

  // Explicit user picks, keyed the same way so a resolve for a *different*
  // identity (new resolveKey) can't leak a stale manual choice — no effect
  // needed, a stale manual entry is simply ignored at render time, same
  // pattern as useLocationChildren's staleness check above.
  const [manual, setManual] = useState<{ key: string; path: LocationPath } | null>(null);
  const manualPath: LocationPath = manual?.key === resolveKey ? manual.path : EMPTY_PATH;
  const basePath: LocationPath = [
    manualPath[0] ?? resolvedPath[0],
    manualPath[1] ?? resolvedPath[1],
    manualPath[2] ?? resolvedPath[2],
    manualPath[3] ?? resolvedPath[3],
  ];

  // Each level's *effective* selection is the explicit/resolved pick, or —
  // once its own options have loaded — the first option, computed purely
  // at render time (no auto-select effect, no extra render pass).
  const { nodes: level0 } = useLocationChildren(resolving ? undefined : null);
  const sel0 = basePath[0] ?? level0?.[0] ?? null;

  const { nodes: level1 } = useLocationChildren(resolving ? undefined : (sel0?.id ?? undefined));
  const sel1 = basePath[1] ?? level1?.[0] ?? null;

  const { nodes: level2 } = useLocationChildren(resolving ? undefined : (sel1?.id ?? undefined));
  const sel2 = basePath[2] ?? level2?.[0] ?? null;

  const { nodes: level3 } = useLocationChildren(resolving ? undefined : (sel2?.id ?? undefined));
  const sel3 = basePath[3] ?? level3?.[0] ?? null;

  const path: LocationPath = [sel0, sel1, sel2, sel3];

  const selectAt = (index: 0 | 1 | 2 | 3, node: LocationNode) => {
    const next: LocationPath = [...path];
    next[index] = node;
    for (let i = index + 1; i < 4; i++) next[i] = null;
    setManual({ key: resolveKey, path: next });
  };

  const allLevels = [
    { label: "Division", options: level0 ?? [], selected: sel0, visible: true },
    { label: "District", options: level1 ?? [], selected: sel1, visible: Boolean(sel0) },
    { label: labelFor(sel2?.type) ?? "Upazila / City Corporation", options: level2 ?? [], selected: sel2, visible: Boolean(sel1) },
    { label: labelFor(sel3?.type) ?? "Union / Area", options: level3 ?? [], selected: sel3, visible: Boolean(sel2) },
  ];
  const levels = resolving ? [] : allLevels.filter((l) => l.visible);

  return {
    resolving,
    path,
    levels,
    selectAt,
    leaf: sel3,
  };
}

function labelFor(type: LocationNode["type"] | undefined): string | null {
  switch (type) {
    case "UPAZILA":
      return "Upazila";
    case "CITY_CORPORATION":
      return "City Corporation";
    case "THANA":
      return "Thana";
    case "UNION":
      return "Union";
    case "CITY_CORP_AREA":
      return "Thana / Area";
    case "WARD":
      return "Ward";
    default:
      return null;
  }
}

/**
 * Folds the chosen Upazila/Union or City-Corporation-Area (Thana) names
 * into one free-text address string, same shape the old bd-geo.ts
 * composeAddress produced — kept so order/profile addresses stay
 * human-readable without a second lookup. `path` must have at least
 * levels 2-3 (Upazila|CityCorporation, then the leaf) resolved.
 */
export function composeAddress(freeText: string, landmark: string): string {
  const base = freeText.trim();
  return landmark.trim() ? `${base} (Landmark: ${landmark.trim()})` : base;
}

const COMPOSED_SUFFIX_RE =
  /^(.*?)(?:,\s*[^,()]+ Upazila,\s*[^,()]+ Union|,\s*[^,()]+ Thana)?(?:\s*\(Landmark:\s*(.*?)\))?$/;

/** Strips a previously-`composeAddress`d suffix back off, for showing a
 *  clean editable value in a form (so re-saving doesn't double the suffix).
 *  Falls back to the whole string as free text when it doesn't match — e.g.
 *  an address saved before this composition existed. */
export function stripComposedAddress(fullAddress: string): { address: string; landmark: string } {
  const m = fullAddress.match(COMPOSED_SUFFIX_RE);
  return { address: (m?.[1] ?? fullAddress).trim(), landmark: (m?.[2] ?? "").trim() };
}
