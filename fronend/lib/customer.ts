"use client";

import { useSyncExternalStore } from "react";
import { getMe, type Customer } from "@/lib/api";

/*
 * Shared signed-in-customer state, sourced from the session cookie via
 * GET /api/me. Single source of truth so the nav (avatar vs "Sign in") and
 * the account page always agree — account-view.tsx pushes updates here via
 * setCustomer() after login/logout/register/profile-save instead of keeping
 * its own separate copy that could drift out of sync with the nav.
 */

// undefined = still checking the session cookie, null = signed out.
let customer: Customer | null | undefined;
let started = false;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

async function load() {
  try {
    customer = await getMe();
  } catch {
    customer = null;
  }
  notify();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  if (!started && typeof window !== "undefined") {
    started = true;
    window.addEventListener("focus", () => void load());
    void load();
  }
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): Customer | null | undefined {
  return customer;
}

function getServerSnapshot(): Customer | null | undefined {
  return undefined;
}

/** The signed-in customer, or null when signed out, or undefined while the
 *  session cookie is still being checked. */
export function useCustomer(): Customer | null | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Push a fresh value into the shared store — call after login, logout,
 *  register or a profile save so every subscriber (nav, account page)
 *  re-renders with the new state immediately. */
export function setCustomer(next: Customer | null) {
  customer = next;
  notify();
}
