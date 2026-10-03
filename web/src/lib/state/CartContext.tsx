"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { toast } from "sonner";
import { cartStore, wishOwnerStore, wishStore } from "@/lib/state/stores";
import { useAuth } from "@/lib/state/AuthContext";
import { loadWishlist, mergeWishlist, removeFromWishlist, saveToWishlist } from "@/lib/api/wishlist";
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
  /** Opens or closes the drawer. `justAdded` (a variant id) tells the drawer which line was just put in. */
  setOpen: (v: boolean, justAdded?: string) => void;
  /** The variant whose add opened the drawer, or null when the shopper opened it themselves. */
  justAdded: string | null;
  wishlist: string[];
  toggleWish: (productId: string) => boolean;
}

const Ctx = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const lines = useSyncExternalStore(cartStore.subscribe, cartStore.getSnapshot, cartStore.getServerSnapshot);
  const wishlist = useSyncExternalStore(wishStore.subscribe, wishStore.getSnapshot, wishStore.getServerSnapshot);
  const [open, setOpenState] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const setOpen = useCallback((v: boolean, added?: string) => {
    setOpenState(v);
    setJustAdded(v ? (added ?? null) : null);
  }, []);
  const { user } = useAuth();
  const userId = user?.id ?? null;
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

  // Saved pieces. Signed out (or in mock mode) the list is this device's own. Signed in with the real API it is the
  // account's: on sign-in the device's list is merged into the account's, `wishStore` then mirrors the server, and
  // on sign-out it is emptied so the next person on this device starts clean.
  const syncedFor = useRef<string | null>(null);
  useEffect(() => {
    if (SITE.useMock) return;
    if (!userId) {
      if (syncedFor.current) {
        wishStore.set([]);
        wishOwnerStore.set(null);
        syncedFor.current = null;
      }
      return;
    }
    if (syncedFor.current === userId) return;
    syncedFor.current = userId;
    // Already this account's mirror (an ordinary page load): just read the server's copy. A device list with no owner
    // is merged in once. Another account's leftovers are never merged into this one.
    const owner = wishOwnerStore.getSnapshot();
    const sync = owner === userId ? loadWishlist() : mergeWishlist(owner === null ? wishStore.getSnapshot() : []);
    sync.then(
      (ids) => {
        wishStore.set(ids);
        wishOwnerStore.set(userId);
      },
      () => {
        syncedFor.current = null; // try again on the next render of this effect (next sign-in or reload)
      },
    );
  }, [userId]);

  const toggleWish = useCallback(
    (productId: string) => {
      const has = wishStore.getSnapshot().includes(productId);
      wishStore.set((cur) => (has ? cur.filter((id) => id !== productId) : [...cur, productId]));
      if (!SITE.useMock && userId && wishOwnerStore.getSnapshot() === userId) {
        (has ? removeFromWishlist(productId) : saveToWishlist(productId)).catch((e: Error) => {
          // Put it back the way it was and say so: a heart that silently fails is worse than none.
          wishStore.set((cur) => (has ? (cur.includes(productId) ? cur : [...cur, productId]) : cur.filter((id) => id !== productId)));
          toast.error(e.message || "We couldn't update your wishlist. Please try again.");
        });
      }
      return !has;
    },
    [userId],
  );

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
      justAdded,
      wishlist,
      toggleWish,
    };
  }, [lines, wishlist, open, setOpen, justAdded, add, setQty, remove, clear, toggleWish, loaded]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart must be used inside <CartProvider>");
  return v;
}
