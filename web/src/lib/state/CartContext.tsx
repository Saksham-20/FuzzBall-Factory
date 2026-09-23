"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cartStore, wishStore } from "@/lib/state/stores";
import { lookupProduct } from "@/lib/state/productCache";
import { getProductsByIds } from "@/lib/api/checkout-extra";
import type { CartLine, Product } from "@/lib/types";
import { SAMPLE_SETTINGS, SITE } from "@/lib/site";

interface CartApi {
  lines: CartLine[];
  /** The product behind a cart line: the seed catalogue in mock mode, the API (fetched by id) otherwise. */
  productOf: (productId: string) => Product | undefined;
  count: number;
  subtotal: number;
  hasMadeToOrder: boolean;
  maxLeadTime: number;
  freeShippingRemaining: number;
  add: (line: CartLine) => void;
  setQty: (productId: string, variantId: string, qty: number) => void;
  remove: (productId: string, variantId: string) => void;
  clear: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  wishlist: string[];
  toggleWish: (productId: string) => boolean;
}

const Ctx = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const lines = useSyncExternalStore(cartStore.subscribe, cartStore.getSnapshot, cartStore.getServerSnapshot);
  const wishlist = useSyncExternalStore(wishStore.subscribe, wishStore.getSnapshot, wishStore.getServerSnapshot);
  const [open, setOpen] = useState(false);
  // Real API: cart lines carry database ids, so the products are fetched once per id and cached (productCache).
  const [loaded, setLoaded] = useState(0);
  const tried = useRef(new Set<string>());
  useEffect(() => {
    if (SITE.useMock) return;
    const missing = [...new Set(lines.map((l) => l.productId))].filter((id) => !lookupProduct(id) && !tried.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => tried.current.add(id));
    getProductsByIds(missing).then(() => setLoaded((n) => n + 1), () => missing.forEach((id) => tried.current.delete(id)));
  }, [lines]);

  const add = useCallback((line: CartLine) => {
    cartStore.set((cur) => {
      const p = lookupProduct(line.productId);
      const i = cur.findIndex((l) => l.productId === line.productId && l.variantId === line.variantId);
      const cap = p?.isOneOfAKind ? 1 : 10;
      if (i === -1) return [...cur, { ...line, qty: Math.min(line.qty, cap) }];
      const next = [...cur];
      next[i] = { ...next[i], qty: Math.min(next[i].qty + line.qty, cap) };
      return next;
    });
  }, []);

  const setQty = useCallback((productId: string, variantId: string, qty: number) => {
    cartStore.set((cur) =>
      cur
        .map((l) => (l.productId === productId && l.variantId === variantId ? { ...l, qty } : l))
        .filter((l) => l.qty > 0),
    );
  }, []);

  const remove = useCallback((productId: string, variantId: string) => {
    cartStore.set((cur) => cur.filter((l) => !(l.productId === productId && l.variantId === variantId)));
  }, []);

  const clear = useCallback(() => cartStore.set([]), []);

  const toggleWish = useCallback((productId: string) => {
    const has = wishStore.getSnapshot().includes(productId);
    wishStore.set((cur) => (has ? cur.filter((id) => id !== productId) : [...cur, productId]));
    return !has;
  }, []);

  const api = useMemo<CartApi>(() => {
    void loaded; // recompute once products fetched from the API land in the cache
    const priced = lines.map((l) => ({ l, p: lookupProduct(l.productId) })).filter((x) => x.p);
    const subtotal = priced.reduce((s, { l, p }) => s + p!.price * l.qty, 0);
    return {
      lines,
      productOf: lookupProduct,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal,
      hasMadeToOrder: priced.some(({ p }) => p!.fulfilment === "MADE_TO_ORDER"),
      maxLeadTime: Math.max(0, ...priced.map(({ p }) => p!.leadTimeDays)),
      freeShippingRemaining: Math.max(0, SAMPLE_SETTINGS.freeShippingAbove - subtotal),
      add,
      setQty,
      remove,
      clear,
      open,
      setOpen,
      wishlist,
      toggleWish,
    };
  }, [lines, wishlist, open, add, setQty, remove, clear, toggleWish, loaded]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart must be used inside <CartProvider>");
  return v;
}
