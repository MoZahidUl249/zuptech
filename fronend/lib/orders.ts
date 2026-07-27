"use client";

/*
 * Orders now live in the backend (POST /api/orders, GET /api/my/orders with
 * a phone+password session — see lib/api.ts). The only thing kept locally is
 * the last phone number used, to prefill the account sign-in form.
 */

const PHONE_KEY = "zup-auth-phone";

let phoneCache: string | null | undefined;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribeAccount(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getPhoneSnapshot(): string | null {
  if (phoneCache === undefined) {
    try {
      phoneCache = localStorage.getItem(PHONE_KEY);
    } catch {
      phoneCache = null;
    }
  }
  return phoneCache;
}

export function getPhoneServerSnapshot(): string | null {
  return null;
}

export function setAuthPhone(phone: string | null) {
  phoneCache = phone;
  try {
    if (phone === null) localStorage.removeItem(PHONE_KEY);
    else localStorage.setItem(PHONE_KEY, phone);
  } catch {
    // storage unavailable
  }
  notify();
}
