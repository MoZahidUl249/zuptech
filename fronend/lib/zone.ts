"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * Delivery zone — the one input the pricing API needs to turn a subtotal into
 * a real total.
 *
 * The backend prices delivery and installation as a two-tier boolean
 * (inside vs outside Dhaka), so this is deliberately not a location tree.
 * Persisted so the choice carries from cart to checkout.
 *
 * Same external-store shape as lib/cart.tsx: localStorage state syncs into
 * React without setState-in-effect hydration hacks.
 */

const STORAGE_KEY = "zup-zone";

/** Matches Customer.insideDhaka's default in the Prisma schema. */
const DEFAULT_INSIDE_DHAKA = true;

let zoneState = DEFAULT_INSIDE_DHAKA;
let loaded = false;
const listeners = new Set<() => void>();

function loadOnce() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) zoneState = raw === "true";
  } catch {
    zoneState = DEFAULT_INSIDE_DHAKA;
  }
}

function getSnapshot(): boolean {
  loadOnce();
  return zoneState;
}

/** Stable value on the server so SSR and the first client render agree. */
function getServerSnapshot(): boolean {
  return DEFAULT_INSIDE_DHAKA;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function setZone(next: boolean) {
  zoneState = next;
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // storage unavailable (private mode) — choice stays in memory
  }
  listeners.forEach((l) => l());
}

/** `[insideDhaka, setInsideDhaka]` — shared by the cart and checkout. */
export function useDeliveryZone(): [boolean, (v: boolean) => void] {
  const insideDhaka = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const set = useCallback((v: boolean) => setZone(v), []);
  return [insideDhaka, set];
}

export const ZONE_OPTIONS = [
  { value: "inside" as const, label: "Inside Dhaka" },
  { value: "outside" as const, label: "Outside Dhaka" },
];
