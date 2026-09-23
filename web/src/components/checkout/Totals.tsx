import { formatINR } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Props {
  subtotal: number;
  shipping: number;
  shippingLabel?: string;
  giftWrap?: number;
  codFee?: number;
  discount?: number;
  couponCode?: string;
  total: number;
  /** Softens the figures while a new quote is loading. */
  stale?: boolean;
  className?: string;
}

/** Itemised totals, in the order the E-Commerce Rules expect: goods, delivery, extras, discount, total. */
export function Totals({ subtotal, shipping, shippingLabel, giftWrap = 0, codFee = 0, discount = 0, couponCode, total, stale, className }: Props) {
  const row = "flex items-baseline justify-between gap-4";
  return (
    <dl className={cn("space-y-2 text-[15px] transition-opacity duration-150", stale && "opacity-60", className)} aria-busy={stale || undefined}>
      <div className={row}>
        <dt>Subtotal</dt>
        <dd className="tabular font-semibold">{formatINR(subtotal)}</dd>
      </div>
      <div className={row}>
        <dt>{shippingLabel || "Shipping"}</dt>
        <dd className="tabular font-semibold">{shipping === 0 ? "Free" : formatINR(shipping)}</dd>
      </div>
      {giftWrap > 0 ? (
        <div className={row}>
          <dt>Gift wrap</dt>
          <dd className="tabular font-semibold">{formatINR(giftWrap)}</dd>
        </div>
      ) : null}
      {codFee > 0 ? (
        <div className={row}>
          <dt>Cash on delivery fee</dt>
          <dd className="tabular font-semibold">{formatINR(codFee)}</dd>
        </div>
      ) : null}
      {discount > 0 ? (
        <div className={row}>
          <dt>Discount{couponCode ? <span className="font-stencil ml-2 text-[11px]">{couponCode}</span> : null}</dt>
          <dd className="tabular font-semibold text-ok">−{formatINR(discount)}</dd>
        </div>
      ) : null}
      <div className={cn(row, "border-t border-cocoa/20 pt-3")}>
        <dt className="text-lg font-bold">Total</dt>
        <dd className="tabular text-2xl font-bold">{formatINR(total)}</dd>
      </div>
    </dl>
  );
}
