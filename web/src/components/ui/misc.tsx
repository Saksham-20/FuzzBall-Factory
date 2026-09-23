"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { YarnBall } from "@/components/brand/YarnBall";
import { CrochetHook } from "@/components/brand/CrochetHook";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Swatch } from "@/lib/types";

export function Skeleton({ className, ...p }: ComponentPropsWithoutRef<"div">) {
  return <div aria-hidden className={cn("animate-pulse rounded-[10px] bg-kraft-light motion-reduce:animate-none", className)} {...p} />;
}

/** Crochet hook rocking side to side: the loader. */
export function HookSpinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("inline-block", className)}>
      <CrochetHook wound={false} className="h-10 w-5 origin-[68%_10%] animate-[hook-spin_900ms_ease-in-out_infinite] motion-reduce:animate-none" />
    </span>
  );
}

export function EmptyState({ title, children, action, className }: { title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-14 text-center", className)}>
      <YarnBall className="w-24" spin={false} tone="kraft" />
      <h2 className="font-display text-[2rem]">{title}</h2>
      {children ? <p className="max-w-[44ch] text-brown">{children}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorNote({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-[12px] bg-err-wash px-4 py-3 text-err">
      <p className="font-medium">{children}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-1 min-h-11 font-semibold underline">
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function Price({ price, compareAt, className }: { price: number; compareAt?: number; className?: string }) {
  return (
    <span className={cn("tabular inline-flex items-baseline gap-2 font-bold", className)}>
      <span>{formatINR(price)}</span>
      {compareAt && compareAt > price ? <s className="text-sm font-medium text-brown-soft">{formatINR(compareAt)}</s> : null}
    </span>
  );
}

export function QuantityStepper({ value, onChange, min = 1, max = 10, label = "Quantity" }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label?: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex items-center rounded-full bg-paper shadow-ticket">
      <button type="button" aria-label="Decrease quantity" disabled={value <= min} onClick={() => onChange(value - 1)} className="press grid size-11 place-items-center disabled:opacity-40">
        <Minus className="size-4" />
      </button>
      <span aria-live="polite" className="tabular w-8 text-center font-semibold">
        {value}
      </span>
      <button type="button" aria-label="Increase quantity" disabled={value >= max} onClick={() => onChange(value + 1)} className="press grid size-11 place-items-center disabled:opacity-40">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

interface SwatchProps {
  swatches: Swatch[];
  /** selected colour names */
  value: string[];
  onChange: (names: string[]) => void;
  multiple?: boolean;
  /** colour names with no stock */
  soldOut?: string[];
  label: string;
}

/** Colour dots. Single-select by default, `multiple` for the custom form. */
export function SwatchPicker({ swatches, value, onChange, multiple, soldOut = [], label }: SwatchProps) {
  const toggle = (name: string) => {
    if (multiple) onChange(value.includes(name) ? value.filter((v) => v !== name) : [...value, name]);
    else onChange([name]);
  };
  return (
    <div role={multiple ? "group" : "radiogroup"} aria-label={label} className="flex flex-wrap gap-2.5">
      {swatches.map((s) => {
        const on = value.includes(s.name);
        const out = soldOut.includes(s.name);
        return (
          <button
            key={s.name}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={on}
            aria-label={out ? `${s.name}, sold out` : s.name}
            title={s.name}
            disabled={out}
            onClick={() => toggle(s.name)}
            className={cn("press relative grid size-11 place-items-center rounded-full ring-offset-2 ring-offset-cream transition-shadow duration-150", on ? "ring-[2.5px] ring-cocoa" : "ring-1 ring-line-strong", out && "opacity-45")}
          >
            <span className="size-8 rounded-full border border-cocoa/15" style={{ background: s.hex }} />
            {out ? <span aria-hidden className="absolute h-[2px] w-9 -rotate-45 bg-cocoa/70" /> : null}
          </button>
        );
      })}
    </div>
  );
}

export function PageHeader({ title, children, className }: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)]">{title}</h1>
      {children}
    </div>
  );
}

/** Free-shipping progress drawn as yarn: a dotted track with a solid rose thread laid over it. `value` is 0–1. */
export function ThreadProgress({ value, className }: { value: number; className?: string }) {
  const v = Math.min(1, Math.max(0, value));
  return (
    <div aria-hidden className={cn("relative h-3", className)}>
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-[3px] border-dotted border-kraft-deep/55" />
      <div className="absolute inset-0 flex items-center">
        <div className="h-1 w-full origin-left rounded-full bg-rose transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: `scaleX(${v})` }} />
      </div>
    </div>
  );
}
