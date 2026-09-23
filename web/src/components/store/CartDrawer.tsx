"use client";

import Image from "next/image";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ThreadProgress } from "@/components/ui/misc";
import { YarnBall } from "@/components/brand/YarnBall";
import { useCart } from "@/lib/state/CartContext";
import { formatINR, formatDate, dispatchDate } from "@/lib/format";
import { SAMPLE_SETTINGS } from "@/lib/site";
import { waLink } from "@/lib/whatsapp";

export function CartDrawer() {
  const { open, setOpen, lines, count, subtotal, remove, setQty, hasMadeToOrder, maxLeadTime, freeShippingRemaining, productOf } =
    useCart();
  const progress = Math.min(1, subtotal / SAMPLE_SETTINGS.freeShippingAbove);

  const items = lines
    .map((l) => ({ l, p: productOf(l.productId) }))
    .filter((x): x is { l: typeof x.l; p: NonNullable<typeof x.p> } => !!x.p);

  const waText =
    "Hi! I'd like to order:\n" +
    items.map(({ l, p }) => `• ${p.name} × ${l.qty}`).join("\n") +
    `\nTotal ${formatINR(subtotal)}`;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-cocoa/45 data-[state=closed]:animate-[fade-out_200ms_ease-out_forwards] data-[state=open]:animate-[fade-in_250ms_ease-out]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[430px] flex-col bg-paper shadow-lift outline-none data-[state=closed]:animate-[drawer-out_240ms_var(--ease-drawer)_forwards] data-[state=open]:animate-[drawer-in_380ms_var(--ease-drawer)]"
        >
          <header className="flex items-center justify-between px-5 pt-5 pb-3">
            <Dialog.Title className="font-display text-[2rem]">
              Your basket <span className="font-stencil tabular align-middle text-[13px] text-brown-soft">({count})</span>
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close basket"
              className="press grid size-11 place-items-center rounded-full text-cocoa [@media(hover:hover)_and_(pointer:fine)]:hover:bg-cocoa/8"
            >
              <X className="size-5" />
            </Dialog.Close>
          </header>

          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
              <YarnBall className="w-28" spin={false} />
              <p className="font-display text-[1.75rem]">Your basket&apos;s empty</p>
              <p className="max-w-[28ch] text-brown">Yarn is waiting on the shelf. Pick something to take home.</p>
              <Button asChild onClick={() => setOpen(false)}>
                <Link href="/shop">Shop the shelf</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="px-5 pb-3">
                <p className="text-sm font-medium text-brown">
                  {freeShippingRemaining > 0
                    ? `${formatINR(freeShippingRemaining)} away from free shipping in India`
                    : "Free shipping in India unlocked"}
                </p>
                <ThreadProgress value={progress} className="mt-2" />
              </div>

              <ul className="flex-1 divide-y divide-line overflow-y-auto px-5" data-lenis-prevent>
                {items.map(({ l, p }) => {
                  const v = p.variants.find((x) => x.id === l.variantId);
                  return (
                    <li key={l.variantId} className="flex gap-3 py-4">
                      <Link href={`/p/${p.slug}`} onClick={() => setOpen(false)} className="relative size-20 shrink-0 overflow-hidden rounded-[10px] bg-kraft-light">
                        <Image src={p.images[0].src} alt={p.images[0].alt} fill sizes="80px" className="object-cover" />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold leading-snug">{p.name}</p>
                        <p className="text-sm text-brown">{[v?.colour, v?.size].filter(Boolean).join(" · ")}</p>
                        <p className="font-stencil mt-1 text-[11px] text-brown-soft">
                          {p.fulfilment === "READY" ? "Ready to ship" : `Made to order · ${p.leadTimeDays} days`}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="inline-flex items-center rounded-full bg-cream">
                            <button type="button" aria-label="Decrease quantity" onClick={() => setQty(l.productId, l.variantId, l.qty - 1)} className="press grid size-11 place-items-center">
                              <Minus className="size-4" />
                            </button>
                            <span className="tabular w-6 text-center font-semibold">{l.qty}</span>
                            <button type="button" aria-label="Increase quantity" disabled={p.isOneOfAKind} onClick={() => setQty(l.productId, l.variantId, l.qty + 1)} className="press grid size-11 place-items-center disabled:opacity-40">
                              <Plus className="size-4" />
                            </button>
                          </div>
                          <span className="tabular font-bold">{formatINR(p.price * l.qty)}</span>
                        </div>
                        <button type="button" onClick={() => remove(l.productId, l.variantId)} className="mt-1 min-h-11 text-sm text-brown underline">
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <footer className="space-y-3 border-t border-line bg-cream px-5 py-4">
                {hasMadeToOrder ? (
                  <p className="text-sm text-brown">
                    Made-to-order pieces in your basket: estimated dispatch{" "}
                    <strong className="font-semibold text-cocoa">{formatDate(dispatchDate(maxLeadTime))}</strong>.
                  </p>
                ) : null}
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">Subtotal</span>
                  <span className="tabular text-xl font-bold">{formatINR(subtotal)}</span>
                </div>
                <p className="text-xs text-brown-soft">Shipping and any gift wrap are added at checkout.</p>
                <Button asChild size="lg" className="w-full" onClick={() => setOpen(false)}>
                  <Link href="/checkout">Checkout</Link>
                </Button>
                <Button asChild variant="secondary" className="w-full">
                  <a href={waLink(waText)} target="_blank" rel="noopener noreferrer">
                    Send basket on WhatsApp
                  </a>
                </Button>
              </footer>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
