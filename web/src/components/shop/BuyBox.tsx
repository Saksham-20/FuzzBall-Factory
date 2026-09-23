"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Heart, MessageCircle, PencilRuler, Share2, Sun } from "lucide-react";
import { toast } from "sonner";
import { Stamp } from "@/components/brand/Stamp";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Price, QuantityStepper, SwatchPicker } from "@/components/ui/misc";
import { DeliveryCheck } from "@/components/shop/DeliveryCheck";
import { FlyingBall, bagCenter, prefersReducedMotion, type Flight } from "@/components/shop/FlyingBall";
import { LeadTimeThread } from "@/components/shop/LeadTimeThread";
import { SizeGuide } from "@/components/shop/SizeGuide";
import { ShareMenu } from "@/components/store/ShareMenu";
import type { ShippingCheck } from "@/lib/api/shipping";
import { useCart } from "@/lib/state/CartContext";
import { batchLabel, formatINR } from "@/lib/format";
import { SITE } from "@/lib/site";
import { waProduct, waRealLight } from "@/lib/whatsapp";
import { cn } from "@/lib/cn";
import type { Product } from "@/lib/types";

const PERSONALIZE_MAX = 20;
const BAR_OFFSET = "calc(72px + env(safe-area-inset-bottom, 0px))";

const pill = cn(
  "press inline-flex min-h-11 items-center gap-2 rounded-full bg-paper px-4 text-sm font-semibold text-cocoa shadow-ticket transition-shadow duration-150",
  `hf:hover:shadow-lift`,
);

/** The product's info column: choices, lead time, delivery check and every way to buy or ask. */
export function BuyBox({ product: p }: { product: Product }) {
  const router = useRouter();
  const cart = useCart();

  const soldOut = p.variants.every((v) => v.stock === 0);
  const sizes = [...new Set(p.variants.map((v) => v.size).filter((s): s is string => !!s))];
  const hasSizes = sizes.length > 0;
  const personalizable = p.tags.includes("personalizable");
  const soldOutColours = p.swatches
    .filter((s) => p.variants.filter((v) => v.colour === s.name).every((v) => v.stock === 0))
    .map((s) => s.name);

  const [colour, setColour] = useState(() => p.swatches.find((s) => !soldOutColours.includes(s.name))?.name ?? p.swatches[0]?.name ?? "");
  const [size, setSize] = useState("");
  const [sizeError, setSizeError] = useState<string>();
  const [text, setText] = useState("");
  const [qty, setQty] = useState(1);
  const [check, setCheck] = useState<ShippingCheck>();
  const [guide, setGuide] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [pushing, setPushing] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);

  const sizeRef = useRef<HTMLSelectElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  const variant = p.variants.find((v) => (!colour || v.colour === colour) && (!hasSizes || v.size === size));
  const price = p.price + (variant?.priceDelta ?? 0);
  const max = p.isOneOfAKind ? 1 : Math.max(1, Math.min(10, variant?.stock ?? 10));
  const q = Math.min(qty, max);
  const wished = cart.wishlist.includes(p.id);
  const barShown = !soldOut && !ctaVisible;
  const busy = flight !== null || pushing;

  // Sticky mobile bar: show it while the main buy button is off screen, and tell the WhatsApp button how much to clear.
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCtaVisible(e.isIntersecting), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [soldOut]);

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => root.style.setProperty("--sticky-offset", barShown && !mq.matches ? BAR_OFFSET : "0px");
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      root.style.removeProperty("--sticky-offset");
    };
  }, [barShown]);

  /** Returns the chosen variant, or null after telling the shopper what is missing. */
  const choose = () => {
    if (hasSizes && !size) {
      setSizeError("Choose a size first.");
      sizeRef.current?.focus();
      sizeRef.current?.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
      return null;
    }
    if (!variant || variant.stock === 0) {
      toast.error("That combination is sold out. Try another colour or size.");
      return null;
    }
    return variant;
  };

  const addLine = (v: NonNullable<typeof variant>) =>
    cart.add({ productId: p.id, variantId: v.id, qty: q, personalization: personalizable && text.trim() ? text.trim() : undefined });

  const onAdd = (e: MouseEvent<HTMLButtonElement>) => {
    const v = choose();
    if (!v) return;
    addLine(v);
    toast.success(`${p.name} is in your basket`);
    const to = bagCenter();
    // No flight for keyboard activation (detail 0), reduced motion, or a bag that isn't on screen.
    if (e.detail === 0 || prefersReducedMotion() || !to) {
      cart.setOpen(true);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setFlight({ id: Date.now(), from: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, to });
  };

  const onBuyNow = () => {
    const v = choose();
    if (!v) return;
    addLine(v);
    setPushing(true);
    router.push("/checkout");
  };

  const status = soldOut ? (
    <Badge tone="sold">Sold</Badge>
  ) : p.fulfilment === "READY" ? (
    <Badge tone="ready">Ready to ship</Badge>
  ) : (
    <Badge tone="mto">Made to order · {p.leadTimeDays} days</Badge>
  );

  return (
    <div className="flex flex-col gap-5">
      <div
        data-placeholder={SITE.useMock && p.sample ? "sample-product" : undefined}
        className="relative flex flex-wrap items-center gap-2"
      >
        <span className="font-stencil tabular text-[13px] text-brown">{batchLabel(p.batch)}</span>
        {status}
        {p.isOneOfAKind ? <Badge tone="ooak">One of one</Badge> : null}
        {SITE.useMock && p.sample ? <Badge tone="sample">Sample</Badge> : null}
      </div>

      <div>
        <h1 className="text-[2rem] leading-[1.1] font-extrabold tracking-[-0.02em] text-balance">{p.name}</h1>
        <p className="mt-2 max-w-[44ch] text-[1.0625rem] text-brown">{p.tagline}</p>
      </div>

      <Price price={price} compareAt={p.compareAtPrice} className="text-[1.5rem]" />

      {soldOut ? (
        <div className="flex flex-col items-start gap-4 rounded-ticket bg-paper p-5 shadow-ticket">
          <Stamp label="Sold" tone="ink" rotate={-6} className="px-6 py-2.5 text-[28px]" />
          <p className="max-w-[40ch]">
            {p.isOneOfAKind ? "This one found a home. It was the only one." : "This piece is sold out right now."} Every piece is made by hand, so we can make you a similar one.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg">
              <Link href={`/custom?from=${p.slug}`}>Request a similar one</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href={waProduct(p.name, p.price, `${SITE.url}/p/${p.slug}`)} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden strokeWidth={1.8} />
                Ask on WhatsApp
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {p.swatches.length > 0 ? (
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold">Colour</span>
                <span aria-live="polite" className="text-sm text-brown">
                  {colour}
                </span>
              </div>
              <SwatchPicker
                label="Colour"
                swatches={p.swatches}
                value={colour ? [colour] : []}
                soldOut={soldOutColours}
                onChange={([name]) => {
                  setColour(name);
                  setCheck(undefined);
                }}
              />
            </div>
          ) : null}

          {hasSizes ? (
            <Field label="Size" error={sizeError}>
              {(f) => (
                <div className="flex items-center gap-2">
                  <Select
                    {...f}
                    ref={sizeRef}
                    value={size}
                    onChange={(e) => {
                      setSize(e.target.value);
                      setSizeError(undefined);
                    }}
                    className="flex-1"
                  >
                    <option value="">Choose a size</option>
                    {sizes.map((s) => {
                      const out = p.variants.find((v) => v.colour === colour && v.size === s)?.stock === 0;
                      return (
                        <option key={s} value={s} disabled={out}>
                          {s}
                          {out ? " (sold out)" : ""}
                        </option>
                      );
                    })}
                  </Select>
                  <Button type="button" variant="ghost" onClick={() => setGuide(true)} className="underline">
                    Size guide
                  </Button>
                </div>
              )}
            </Field>
          ) : null}

          {personalizable ? (
            <Field
              label="Add a name or short message"
              optional
              hint={
                <>
                  <span className="tabular">
                    {text.length} / {PERSONALIZE_MAX}
                  </span>{" "}
                  characters. Personalised pieces can&apos;t be returned.
                </>
              }
            >
              {(f) => <Input {...f} value={text} maxLength={PERSONALIZE_MAX} onChange={(e) => setText(e.target.value)} />}
            </Field>
          ) : null}

          <LeadTimeThread product={p} deliverBy={check?.deliverBy} />
          <DeliveryCheck product={p} onResult={setCheck} />

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <QuantityStepper value={q} onChange={setQty} max={max} />
              <div ref={ctaRef} className="min-w-0 flex-1">
                <Button type="button" size="lg" className="w-full" disabled={busy} onClick={onAdd}>
                  Add to cart
                </Button>
              </div>
              <button
                type="button"
                aria-pressed={wished}
                aria-label={wished ? `Remove ${p.name} from wishlist` : `Save ${p.name} to wishlist`}
                onClick={() => cart.toggleWish(p.id)}
                className={cn(
                  "press grid size-[52px] shrink-0 place-items-center rounded-full bg-paper shadow-ticket transition-shadow duration-150",
                  `hf:hover:shadow-lift`,
                )}
              >
                <Heart className={cn("size-[22px] transition-colors duration-150", wished && "fill-rose stroke-rose-deep")} strokeWidth={1.8} />
              </button>
              <ShareMenu
                content={{
                  url: `${SITE.url}/p/${p.slug}`,
                  text: `Check out ${p.name} (${formatINR(price)}) — handmade crochet from FuzzBall Factory.`,
                }}
                label={`Share ${p.name}`}
                className={cn(
                  "press grid size-[52px] shrink-0 place-items-center rounded-full bg-paper shadow-ticket transition-shadow duration-150",
                  `hf:hover:shadow-lift`,
                )}
              >
                <Share2 className="size-[20px]" strokeWidth={1.8} />
              </ShareMenu>
            </div>
            {p.isOneOfAKind ? <p className="text-sm text-brown">Only one of this piece exists.</p> : null}
            <Button type="button" size="lg" variant="secondary" disabled={busy} onClick={onBuyNow}>
              {pushing ? "Taking you to checkout…" : "Buy now"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {p.customizable ? (
              <Link href={`/custom?from=${p.slug}`} className={pill}>
                <PencilRuler aria-hidden className="size-[18px]" strokeWidth={1.8} />
                Customize this
              </Link>
            ) : null}
            <a href={waProduct(p.name, p.price, `${SITE.url}/p/${p.slug}`)} target="_blank" rel="noopener noreferrer" className={pill}>
              <MessageCircle aria-hidden className="size-[18px]" strokeWidth={1.8} />
              Ask on WhatsApp
            </a>
            <a href={waRealLight(p.name)} target="_blank" rel="noopener noreferrer" className={pill}>
              <Sun aria-hidden className="size-[18px]" strokeWidth={1.8} />
              See it in real light
            </a>
          </div>
        </>
      )}

      {hasSizes ? <SizeGuide open={guide} onOpenChange={setGuide} product={p} /> : null}
      {flight ? (
        <FlyingBall
          flight={flight}
          onDone={() => {
            setFlight(null);
            cart.setOpen(true);
          }}
        />
      ) : null}

      {/* Mobile: sticky add-to-cart bar, shown while the main button is off screen. */}
      {!soldOut ? (
        <div
          inert={!barShown}
          aria-hidden={!barShown}
          className={cn(
            "fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 bg-paper px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] shadow-[0_-6px_18px_-8px_rgb(63_38_25/0.25)] transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none lg:hidden",
            barShown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{p.name}</p>
            <Price price={price} className="text-base" />
          </div>
          <Button type="button" size="lg" disabled={busy} onClick={onAdd}>
            Add to cart
          </Button>
        </div>
      ) : null}
    </div>
  );
}
