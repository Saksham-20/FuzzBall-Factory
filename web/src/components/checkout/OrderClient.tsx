"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { MessageCircle, UserPlus } from "lucide-react";
import { Ticket } from "@/components/brand/Ticket";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorNote, Skeleton } from "@/components/ui/misc";
import { BigStamp } from "@/components/checkout/PlacedStamp";
import { OrderTimeline } from "@/components/checkout/OrderTimeline";
import { Totals } from "@/components/checkout/Totals";
import { getOrder } from "@/lib/api/orders";
import { useApi } from "@/lib/api/useApi";
import { ApiError } from "@/lib/mock/db";
import { useAuth } from "@/lib/state/AuthContext";
import { COUNTRIES, ORDER_STATUS } from "@/lib/status";
import { formatDate, formatINR } from "@/lib/format";
import { waOrder } from "@/lib/whatsapp";

export function OrderClient({ number, isNew }: { number: string; isNew: boolean }) {
  const { user } = useAuth();
  const { data: order, error, loading, reload } = useApi(() => getOrder(number), `order:${number}:${user?.id ?? "guest"}`);

  // The stamp lands once: drop ?new=1 so a refresh doesn't replay it.
  useEffect(() => {
    if (isNew && order) window.history.replaceState(null, "", `/order/${number}`);
  }, [isNew, order, number]);

  if (loading && !order) {
    return (
      <div className="shell py-8 md:py-12" aria-busy="true">
        <Skeleton className="h-16 w-72" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    const forbidden = error instanceof ApiError && error.status === 403;
    return (
      <div className="shell py-8 md:py-12">
        <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)]">Order {number}</h1>
        <div className="mt-8 max-w-xl space-y-4">
          <ErrorNote onRetry={reload}>{error?.message ?? "We couldn't load this order."}</ErrorNote>
          <p className="text-brown">
            {forbidden ? (
              <>
                Try{" "}
                <Link href={`/login?next=${encodeURIComponent(`/order/${number}`)}`} className="font-semibold text-cocoa underline">
                  logging in
                </Link>{" "}
                with the account you ordered with, or{" "}
              </>
            ) : (
              "You can "
            )}
            <Link href="/track" className="font-semibold text-cocoa underline">
              track it with your order number and phone
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const meta = ORDER_STATUS[order.status];
  const justPlaced = isNew && !["PENDING_PAYMENT", "CANCELLED", "REFUNDED"].includes(order.status);
  const isCod = order.paymentMethod === "COD";
  const country = COUNTRIES.find((c) => c.code === order.address.country)?.name ?? order.address.country;
  const firstName = order.contact.name.split(" ")[0];
  const guest = !user && !order.userId;

  return (
    <div className="shell py-8 md:py-12">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-6">
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)]">{justPlaced ? `Thank you, ${firstName}` : "Your order"}</h1>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-brown">
            <span className="font-stencil tabular text-[15px] text-cocoa">Order {order.number}</span>
            <span>Placed {formatDate(order.createdAt, { day: "numeric", month: "short", year: "numeric" })}</span>
          </p>
        </div>
        <BigStamp
          label={justPlaced ? "Placed" : meta.label}
          tone={justPlaced ? "ok" : meta.tone}
          shape={meta.shape === "circle" ? "rect" : meta.shape}
          animate={justPlaced}
          rotate={-5}
        />
      </div>

      <div className="mt-6 max-w-[68ch] space-y-3" aria-live="polite">
        {justPlaced ? (
          <p className="text-lg">
            {isCod
              ? "We'll confirm on WhatsApp before dispatch, so please keep your phone handy."
              : "Payment received. Your order is in the queue."}{" "}
            Keep the order number above: you&apos;ll need it with your phone or email to{" "}
            <Link href={`/track?order=${order.number}`} className="font-semibold underline">
              track it
            </Link>
            .
          </p>
        ) : (
          <p className="text-lg">{meta.hint}</p>
        )}
        {order.status === "PENDING_PAYMENT" ? (
          <div role="alert" className="rounded-[12px] bg-warn-wash px-4 py-3 text-warn">
            <p className="font-medium">We haven&apos;t received your payment yet. You haven&apos;t been charged.</p>
            <Link href="/checkout" className="mt-1 inline-flex min-h-11 items-center font-semibold underline">
              Go back to checkout
            </Link>
          </div>
        ) : null}
      </div>

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <Ticket tone="paper" head={[`Order ${order.number}`, `${order.items.length} ${order.items.length === 1 ? "line" : "lines"}`]} className="p-4 pt-2 md:p-6 md:pt-2">
          <ul className="divide-y divide-line">
            {order.items.map((i, idx) => (
              <li key={`${i.productId}-${idx}`} className="flex gap-3 py-4">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-[10px] bg-kraft-light">
                  <Image src={i.image} alt="" fill sizes="80px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-snug">{i.name}</p>
                  <p className="text-sm text-brown">{[i.colour, i.size].filter(Boolean).join(" · ")}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {i.fulfilment === "READY" ? <Badge tone="ready">Ready to ship</Badge> : <Badge tone="mto">Made to order</Badge>}
                  </div>
                  {i.personalization ? <p className="mt-1 text-sm text-brown">Personalization: {i.personalization}</p> : null}
                </div>
                <p className="tabular shrink-0 text-right">
                  <span className="block font-bold">{formatINR(i.unitPrice * i.qty)}</span>
                  {i.qty > 1 ? (
                    <span className="text-sm text-brown-soft">
                      {i.qty} × {formatINR(i.unitPrice)}
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-2 border-t border-line pt-4">
            <Totals
              subtotal={order.subtotal}
              shipping={order.shipping}
              shippingLabel={order.address.country === "IN" ? "Shipping, India" : "Shipping, international"}
              giftWrap={order.giftWrap}
              codFee={order.codFee}
              discount={order.discount}
              total={order.total}
            />
            <p className="mt-3 text-sm text-brown">
              {isCod
                ? `Cash on delivery: ${formatINR(order.total)} due when it arrives.`
                : order.paymentStatus === "PAID"
                  ? "Paid online with Razorpay."
                  : order.paymentStatus === "REFUNDED"
                    ? "Refunded to your original payment method."
                    : order.paymentStatus === "FAILED"
                      ? "The last payment attempt failed."
                      : "Payment pending."}
            </p>
          </div>

          <dl className="mt-6 grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
            <div>
              <dt className="font-stencil text-[11px] text-brown-soft">Delivering to</dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed">
                <span className="font-semibold">{order.address.name}</span>
                <br />
                {order.address.line1}
                {order.address.line2 ? (
                  <>
                    <br />
                    {order.address.line2}
                  </>
                ) : null}
                <br />
                {order.address.city}
                {order.address.state ? `, ${order.address.state}` : ""} <span className="tabular">{order.address.postalCode}</span>
                <br />
                {country}
              </dd>
            </div>
            <div>
              <dt className="font-stencil text-[11px] text-brown-soft">Contact</dt>
              <dd className="mt-1.5 break-words text-[15px] leading-relaxed">
                {order.contact.email}
                <br />
                <span className="tabular">{order.contact.phone}</span>
              </dd>
              {order.giftNote ? (
                <>
                  <dt className="font-stencil mt-4 text-[11px] text-brown-soft">Gift note</dt>
                  <dd className="mt-1.5 text-[15px] leading-relaxed">{order.giftNote}</dd>
                </>
              ) : null}
            </div>
          </dl>
        </Ticket>

        <div className="space-y-8">
          <section aria-labelledby="order-progress" className="rounded-ticket bg-paper p-5 shadow-ticket md:p-7">
            <h2 id="order-progress" className="font-display text-[1.75rem] sm:text-[2rem]">
              Where it is
            </h2>
            {order.courier || order.awb ? (
              <p className="mt-2 text-[15px] text-brown">
                {order.courier ? <>Courier <strong className="font-semibold text-cocoa">{order.courier}</strong>. </> : null}
                {order.awb ? <>AWB <span className="font-stencil tabular text-[13px] text-cocoa">{order.awb}</span></> : null}
              </p>
            ) : null}
            {["PENDING_PAYMENT", "PLACED", "CONFIRMED", "IN_PRODUCTION", "PACKED"].includes(order.status) ? (
              <p className="mt-2 text-[15px] text-brown">
                Estimated dispatch <strong className="font-semibold text-cocoa">{formatDate(order.estimatedDispatch, { day: "numeric", month: "short" })}</strong>.
              </p>
            ) : null}
            <div className="mt-6">
              <OrderTimeline order={order} />
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <a href={waOrder(order.number)} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> Ask about this order
              </a>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/shop">Keep shopping</Link>
            </Button>
          </div>

          {guest ? (
            <section aria-labelledby="order-account" className="rounded-ticket bg-kraft-light p-5">
              <h2 id="order-account" className="text-lg font-bold">
                Keep your orders in one place
              </h2>
              <p className="mt-1 max-w-[52ch] text-[15px] text-brown">
                Create an account with the email you just used and you can see this order, save addresses and follow work orders without hunting for numbers.
              </p>
              <Button asChild className="mt-3">
                <Link href="/signup">
                  <UserPlus /> Create an account
                </Link>
              </Button>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
