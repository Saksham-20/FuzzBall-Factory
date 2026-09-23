"use client";

import Link from "next/link";
import { useMemo } from "react";
import { toast } from "sonner";
import { ShoppingBag, X } from "lucide-react";
import { AccountHeading } from "@/components/account/AccountShell";
import { ProductTicket } from "@/components/store/ProductTicket";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorNote, Skeleton } from "@/components/ui/misc";
import * as catalog from "@/lib/api/catalog";
import { useApi } from "@/lib/api/useApi";
import { useCart } from "@/lib/state/CartContext";
import type { Product } from "@/lib/types";

const GRID = "grid grid-cols-1 gap-x-5 gap-y-8 min-[520px]:grid-cols-2 xl:grid-cols-3";

export function WishlistClient() {
  const { wishlist, toggleWish, add } = useCart();
  // The wishlist only stores ids, so fetch the shelf once and pick the saved pieces from it.
  const { data, error, loading, reload } = useApi(() => catalog.listProducts({ pageSize: 200 }), "wishlist-products", wishlist.length > 0);

  const { saved, missing } = useMemo(() => {
    const byId = new Map((data?.items ?? []).map((p) => [p.id, p]));
    const found: Product[] = [];
    const gone: string[] = [];
    // Newest saved first.
    for (const id of [...wishlist].reverse()) {
      const p = byId.get(id);
      if (p) found.push(p);
      else gone.push(id);
    }
    return { saved: found, missing: gone };
  }, [data, wishlist]);

  function addToCart(p: Product) {
    const v = p.variants[0];
    add({ productId: p.id, variantId: v.id, qty: 1 });
    toast.success(`${p.name} is in your cart.`);
  }

  return (
    <div>
      <AccountHeading title="Wishlist" />
      <p className="mt-3 max-w-[60ch] text-brown">Pieces you&apos;ve saved. Nothing here is reserved, so one-of-a-kind pieces can sell before you get back.</p>

      <div className="mt-8" aria-live="polite">
        {wishlist.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            action={
              <Button asChild>
                <Link href="/shop">Browse the shop</Link>
              </Button>
            }
          >
            Tap the heart on any piece to keep it here for later.
          </EmptyState>
        ) : loading && !data ? (
          <ul className={GRID} aria-label="Loading saved pieces">
            {wishlist.slice(0, 3).map((id) => (
              <li key={id}>
                <Skeleton className="aspect-[4/5] rounded-ticket" />
              </li>
            ))}
          </ul>
        ) : error ? (
          <ErrorNote onRetry={reload}>{error.message}</ErrorNote>
        ) : (
          <>
            {saved.length === 0 ? (
              <EmptyState title="Those pieces are gone">The pieces you saved are no longer in the shop.</EmptyState>
            ) : (
              <ul className={GRID}>
                {saved.map((p) => {
                  const single = p.variants.length === 1;
                  const soldOut = p.variants.every((v) => v.stock === 0);
                  return (
                    <li key={p.id}>
                      <ProductTicket product={p} sizes="(min-width:1280px) 22vw, (min-width:520px) 30vw, 90vw" />
                      <div className="mt-3 flex items-center gap-2">
                        {soldOut ? (
                          <Button size="sm" variant="secondary" className="flex-1" disabled>
                            Sold out
                          </Button>
                        ) : single ? (
                          <Button size="sm" className="flex-1" onClick={() => addToCart(p)}>
                            <ShoppingBag strokeWidth={1.8} aria-hidden />
                            Add to cart
                          </Button>
                        ) : (
                          <Button size="sm" variant="secondary" className="flex-1" asChild>
                            <Link href={`/p/${p.slug}`}>Choose options</Link>
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => toggleWish(p.id)} aria-label={`Remove ${p.name} from wishlist`} className="min-h-11 min-w-11 px-3">
                          <X strokeWidth={2} aria-hidden />
                          <span className="hidden min-[520px]:inline">Remove</span>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {missing.length > 0 ? (
              <p className="mt-8 flex flex-wrap items-center gap-x-3 text-[15px] text-brown">
                {missing.length} saved {missing.length === 1 ? "piece is" : "pieces are"} no longer in the shop.
                <button type="button" onClick={() => missing.forEach((id) => toggleWish(id))} className="inline-flex min-h-11 items-center font-semibold text-cocoa underline">
                  Clear {missing.length === 1 ? "it" : "them"}
                </button>
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
