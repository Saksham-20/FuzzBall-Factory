"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, MessageCircle, X } from "lucide-react";
import { Ticket } from "@/components/brand/Ticket";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { EmptyState, ErrorNote, PageHeader, QuantityStepper, Skeleton, ThreadProgress } from "@/components/ui/misc";
import { Totals } from "@/components/checkout/Totals";
import { useBasket, useCheckoutQuote, useCoupon, type BasketItem } from "@/components/checkout/useBasket";
import { useApi } from "@/lib/api/useApi";
import { useCart } from "@/lib/state/CartContext";
import { getSettings } from "@/lib/api/settings";
import { formatDate, formatINR } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { cn } from "@/lib/cn";

export function CartClient() {
  const basket = useBasket();
  const { cart } = basket;
  const [coupon, setCoupon] = useCoupon();
  const [draft, setDraft] = useState("");
  const { data: settings } = useApi(getSettings, "settings");
  // The basket page prices for India; the exact rate follows the country picked at checkout.
  const { data: q, loading: quoting } = useCheckoutQuote(basket.quoteLines, { country: "IN", coupon: coupon || undefined });

  function apply(e: FormEvent) {
    e.preventDefault();
    setCoupon(draft.trim());
  }

  const header = <PageHeader title="Your basket" />;

  if (basket.loading) {
    return (
      <div className="shell py-8 md:py-12">
        {header}
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px]" aria-busy="true">
          <div className="space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (basket.error) {
    return (
      <div className="shell py-8 md:py-12">
        {header}
        <div className="mt-8 max-w-xl">
          <ErrorNote onRetry={basket.reload}>We couldn&apos;t load your basket. Check your connection and try again.</ErrorNote>
        </div>
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="shell py-8 md:py-12">
        {header}
        <EmptyState
          title="Your basket's empty"
          action={
            <Button asChild size="lg">
              <Link href="/shop">Shop the shelf</Link>
            </Button>
          }
        >
          Yarn is waiting on the shelf. Pick something to take home, or put in a work order for something made just for you.
        </EmptyState>
      </div>
    );
  }

  const remaining = settings && q ? Math.max(0, settings.freeShippingAbove - q.subtotal) : null;
  const progress = settings && q ? Math.min(1, q.subtotal / settings.freeShippingAbove) : 0;

  const waText =
    "Hi! I'd like to order:\n" +
    basket.items.map((i) => `• ${i.product.name} × ${i.line.qty}`).join("\n") +
    `\nTotal ${formatINR(q?.subtotal ?? cart.subtotal)}`;

  return (
    <div className="shell py-8 md:py-12">
      {header}
      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[1fr_400px] lg:gap-14">
        <div>
          {basket.missing.length > 0 ? (
            <div role="alert" className="mb-6 rounded-[12px] bg-warn-wash px-4 py-3 text-warn">
              <p className="font-medium">
                {basket.missing.length === 1 ? "One piece in your basket isn't available any more." : `${basket.missing.length} pieces in your basket aren't available any more.`}
              </p>
              <button
                type="button"
                onClick={() => basket.missing.forEach((l) => cart.remove(l.productId, l.variantId))}
                className="mt-1 min-h-11 font-semibold underline"
              >
                Remove {basket.missing.length === 1 ? "it" : "them"}
              </button>
            </div>
          ) : null}

          {remaining !== null ? (
            <div className="mb-6">
              <p className="text-sm font-medium text-brown" aria-live="polite">
                {remaining > 0 ? `${formatINR(remaining)} away from free shipping in India` : "Free shipping in India unlocked"}
              </p>
              <ThreadProgress value={progress} className="mt-2" />
            </div>
          ) : null}

          <ul className="divide-y divide-line border-y border-line">
            {basket.items.map((item) => (
              <BasketRow key={item.line.variantId} item={item} />
            ))}
          </ul>

          <Button asChild variant="ghost" className="mt-4">
            <Link href="/shop">Keep shopping</Link>
          </Button>
        </div>

        <aside aria-label="Basket total" className="lg:sticky lg:top-28">
          <Ticket head={["Basket", `${cart.count} ${cart.count === 1 ? "piece" : "pieces"}`]} className="p-4 pt-2 md:p-5 md:pt-2">
            <form onSubmit={apply} className="mb-5" noValidate>
              <label htmlFor="coupon" className="mb-1.5 block text-sm font-semibold">
                Discount code
              </label>
              <div className="flex gap-2">
                <Input
                  id="coupon"
                  value={coupon ? coupon : draft}
                  onChange={(e) => setDraft(e.target.value)}
                  readOnly={!!coupon}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  aria-invalid={q?.couponError ? true : undefined}
                  aria-describedby="coupon-msg"
                  className="font-stencil uppercase"
                  placeholder="Enter code"
                />
                {coupon ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-12"
                    onClick={() => {
                      setCoupon("");
                      setDraft("");
                    }}
                  >
                    <X /> Remove
                  </Button>
                ) : (
                  <Button type="submit" variant="secondary" className="h-12" disabled={!draft.trim()}>
                    Apply
                  </Button>
                )}
              </div>
              <p id="coupon-msg" aria-live="polite" className={cn("mt-1.5 text-sm", q?.couponError ? "font-medium text-err" : "text-ok")}>
                {q?.couponError ?? (q?.couponApplied ? `${q.couponApplied} applied.` : "")}
              </p>
            </form>

            {q ? (
              <Totals
                subtotal={q.subtotal}
                shipping={q.shipping}
                shippingLabel={q.shippingLabel || undefined}
                discount={q.discount}
                couponCode={q.couponApplied}
                total={q.total}
                stale={quoting}
              />
            ) : (
              <Skeleton className="h-36" />
            )}

            {q ? (
              <p className="mt-4 text-sm text-brown">
                {q.hasMadeToOrder ? (
                  <>
                    Estimated dispatch <strong className="font-semibold text-cocoa">{formatDate(q.estimatedDispatch, { day: "numeric", month: "short" })}</strong>. Made-to-order pieces are crocheted after you order, up to {q.maxLeadTimeDays} days.
                  </>
                ) : (
                  <>
                    Ready to ship. Estimated dispatch <strong className="font-semibold text-cocoa">{formatDate(q.estimatedDispatch, { day: "numeric", month: "short" })}</strong>.
                  </>
                )}
              </p>
            ) : null}
            <p className="mt-2 text-sm text-brown-soft">Shipping shown is for India. Gift wrap, cash on delivery and other countries are priced at checkout.</p>

            <Button asChild size="lg" className="mt-5 w-full">
              <Link href="/checkout">
                Go to checkout <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="secondary" className="mt-3 w-full">
              <a href={waLink(waText)} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> Send basket on WhatsApp
              </a>
            </Button>
          </Ticket>
        </aside>
      </div>
    </div>
  );
}

function BasketRow({ item }: { item: BasketItem }) {
  const cart = useCart();
  const { line, product: p, variant: v, unitPrice } = item;
  const max = p.isOneOfAKind ? 1 : Math.max(1, Math.min(10, v.stock));
  const soldOut = v.stock === 0;
  return (
    <li className="flex gap-4 py-5">
      <Link href={`/p/${p.slug}`} className="relative size-24 shrink-0 overflow-hidden rounded-[12px] bg-kraft-light sm:size-28">
        <Image src={p.images[0].src} alt={p.images[0].alt} fill sizes="112px" className="object-cover" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/p/${p.slug}`} className="block font-bold leading-snug [@media(hover:hover)_and_(pointer:fine)]:hover:underline">
              {p.name}
            </Link>
            <p className="text-sm text-brown">{[v.colour, v.size].filter(Boolean).join(" · ")}</p>
          </div>
          <p className="tabular shrink-0 font-bold">{formatINR(unitPrice * line.qty)}</p>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {p.fulfilment === "READY" ? <Badge tone="ready">Ready to ship</Badge> : <Badge tone="mto">Made to order · {p.leadTimeDays} days</Badge>}
          {p.isOneOfAKind ? <Badge tone="ooak">One of one</Badge> : null}
        </div>
        {line.personalization ? <p className="mt-1.5 text-sm text-brown">Personalization: {line.personalization}</p> : null}
        {soldOut ? (
          <p role="alert" className="mt-1.5 text-sm font-medium text-err">
            This one just sold out. Remove it to continue.
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-4">
          <QuantityStepper value={line.qty} min={1} max={max} label={`Quantity for ${p.name}`} onChange={(n) => cart.setQty(line.productId, line.variantId, n)} />
          <button type="button" onClick={() => cart.remove(line.productId, line.variantId)} className="min-h-11 text-sm text-brown underline [@media(hover:hover)_and_(pointer:fine)]:hover:text-cocoa">
            Remove<span className="sr-only"> {p.name}</span>
          </button>
        </div>
      </div>
    </li>
  );
}
