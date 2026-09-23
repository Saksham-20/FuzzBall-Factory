"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useApi } from "@/lib/api/useApi";
import { getProductsByIds } from "@/lib/api/checkout-extra";
import { quote } from "@/lib/api/orders";
import { useCart } from "@/lib/state/CartContext";
import { createPersistedStore } from "@/lib/store";
import type { CheckoutOptions } from "@/lib/pricing";
import type { CartLine, Product, ProductVariant } from "@/lib/types";

export interface BasketItem {
  line: CartLine;
  product: Product;
  variant: ProductVariant;
  unitPrice: number;
}

/** The basket joined with product data through the API layer. */
export function useBasket() {
  const cart = useCart();
  const ids = [...new Set(cart.lines.map((l) => l.productId))].sort().join(",");
  const { data: products, error, loading, reload } = useApi(() => getProductsByIds(ids ? ids.split(",") : []), `basket:${ids}`);

  const { items, missing } = useMemo(() => {
    const ok: BasketItem[] = [];
    const gone: CartLine[] = [];
    if (!products) return { items: ok, missing: gone };
    for (const line of cart.lines) {
      const product = products.find((p) => p.id === line.productId);
      const variant = product?.variants.find((v) => v.id === line.variantId);
      if (product && variant) ok.push({ line, product, variant, unitPrice: product.price + variant.priceDelta });
      else gone.push(line);
    }
    return { items: ok, missing: gone };
  }, [cart.lines, products]);

  return {
    items,
    missing,
    /** Lines that can actually be priced (what goes to quote / placeOrder). */
    quoteLines: useMemo(() => items.map((i) => i.line), [items]),
    /** True until the first product lookup finishes. */
    loading: loading && !products,
    error,
    reload,
    cart,
  };
}

export function useCheckoutQuote(lines: CartLine[], opts: CheckoutOptions) {
  const key = JSON.stringify([lines.map((l) => [l.productId, l.variantId, l.qty]), opts]);
  return useApi(() => quote(lines, opts), `quote:${key}`, lines.length > 0);
}

const couponStore = createPersistedStore<string>("fbf-coupon", "");

/** The coupon code the shopper typed on the cart page; carried into checkout. */
export function useCoupon() {
  const code = useSyncExternalStore(couponStore.subscribe, couponStore.getSnapshot, couponStore.getServerSnapshot);
  return [code, (next: string) => couponStore.set(next)] as const;
}
