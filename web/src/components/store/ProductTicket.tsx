"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Heart } from "lucide-react";
import { Ticket } from "@/components/brand/Ticket";
import { Badge } from "@/components/ui/Badge";
import { useCart } from "@/lib/state/CartContext";
import { batchLabel, formatINR } from "@/lib/format";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/cn";
import type { Product } from "@/lib/types";

interface Props {
  product: Product;
  priority?: boolean;
  sizes?: string;
  className?: string;
}


/** A product as a kraft job ticket: batch number, photo, name, price, lead time. */
export function ProductTicket({
  product: p,
  priority,
  sizes = "(min-width:1024px) 22vw, (min-width:768px) 30vw, 62vw",
  className,
}: Props) {
  const { wishlist, toggleWish } = useCart();
  const [burst, setBurst] = useState(0);
  const wished = wishlist.includes(p.id);
  const soldOut = p.variants.every((v) => v.stock === 0);
  const second = p.images[1];

  return (
    <Ticket
      data-placeholder={SITE.useMock && p.sample ? "sample-product" : undefined}
      head={[batchLabel(p.batch), p.isOneOfAKind ? "One of one" : undefined]}
      className={cn(
        "group transition-[transform,box-shadow] duration-200 ease-out",
        `hf:hover:-translate-y-1 hf:hover:-rotate-[0.6deg] hf:hover:shadow-lift`,
        className,
      )}
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-[10px] bg-paper">
        <Image
          src={p.images[0].src}
          alt={p.images[0].alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn(
            "object-cover transition-opacity duration-300 ease-out",
            soldOut && "saturate-[0.35]",
          )}
        />
        {second && !soldOut ? (
          <Image
            src={second.src}
            alt=""
            fill
            sizes={sizes}
            className={cn(
              "object-cover opacity-0 transition-opacity duration-300 ease-out",
              `hf:group-hover:opacity-100`,
            )}
          />
        ) : null}

        {SITE.useMock && p.sample ? (
          <Badge tone="sample" className="absolute top-2 left-2">
            Sample
          </Badge>
        ) : null}

        <div className="absolute bottom-2 left-2 flex gap-1.5">
          {soldOut ? (
            <Badge tone="sold">Sold</Badge>
          ) : p.fulfilment === "READY" ? (
            <Badge tone="ready">Ready to ship</Badge>
          ) : (
            <Badge tone="mto">Made to order · {p.leadTimeDays} days</Badge>
          )}
        </div>
      </div>

      <div className="px-1 pt-3 pb-1.5">
        <h3 className="text-[1.0625rem] leading-snug font-bold tracking-[-0.01em]">
          <Link
            href={`/p/${p.slug}`}
            className="rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-offset-4"
          >
            {p.name}
          </Link>
        </h3>
        <p className="tabular mt-0.5 text-[15px] font-semibold text-brown">{formatINR(p.price)}</p>
      </div>

      <button
        type="button"
        aria-pressed={wished}
        aria-label={wished ? `Remove ${p.name} from wishlist` : `Save ${p.name} to wishlist`}
        onClick={() => {
          if (toggleWish(p.id)) setBurst((b) => b + 1);
        }}
        className="press absolute top-[52px] right-[18px] z-10 grid size-11 place-items-center rounded-full bg-paper/95 text-cocoa shadow-ticket"
      >
        <Heart
          className={cn("size-[19px] transition-colors duration-150", wished && "fill-rose stroke-rose-deep")}
          strokeWidth={1.9}
        />
        {burst > 0 && wished ? (
          <span key={burst} aria-hidden className="pointer-events-none absolute inset-0">
            {Array.from({ length: 6 }, (_, i) => (
              <i key={i} className="heart-dot" style={{ ["--a" as string]: `${i * 60}deg` }} />
            ))}
          </span>
        ) : null}
      </button>
    </Ticket>
  );
}
