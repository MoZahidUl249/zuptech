"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

export type CartMap = Record<string, number>;

const STORAGE_KEY = "zup-cart";
const EMPTY_CART: CartMap = {};

// Tiny external store so localStorage state syncs into React without
// setState-in-effect hydration hacks.
let cartState: CartMap = EMPTY_CART;
let loaded = false;
const listeners = new Set<() => void>();

function loadOnce() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) cartState = JSON.parse(raw);
  } catch {
    cartState = EMPTY_CART;
  }
}

function getSnapshot(): CartMap {
  loadOnce();
  return cartState;
}

function getServerSnapshot(): CartMap {
  return EMPTY_CART;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function setCartState(next: CartMap) {
  cartState = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable (private mode) — cart stays in memory
  }
  listeners.forEach((l) => l());
}

interface CartContextValue {
  cart: CartMap;
  count: number;
  add: (id: string, qty?: number) => void;
  change: (id: string, delta: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const cart = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((id: string, qty = 1) => {
    setCartState({ ...cartState, [id]: (cartState[id] || 0) + qty });
  }, []);

  const change = useCallback((id: string, delta: number) => {
    const next = { ...cartState };
    const q = (next[id] || 0) + delta;
    if (q <= 0) delete next[id];
    else next[id] = q;
    setCartState(next);
  }, []);

  const clear = useCallback(() => setCartState({}), []);

  // Quantity badge only — all money is priced server-side (POST
  // /api/pricing/quote); the client never multiplies price × qty.
  //
  // Counts every id in the cart. It used to filter against the bundled seed
  // catalog, which meant anything the admin added after build counted 0 — and
  // a cart holding only such products reported empty.
  const count = useMemo(
    () => Object.values(cart).reduce((sum, qty) => sum + qty, 0),
    [cart],
  );

  const value = useMemo(
    () => ({ cart, count, add, change, clear }),
    [cart, count, add, change, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
