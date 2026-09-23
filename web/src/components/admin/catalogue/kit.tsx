"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Field";
import { ErrorNote, Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import type { Product } from "@/lib/types";

/** Small helpers shared by the catalogue-side admin screens (products, categories, customers, reviews, coupons, settings). */

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function SearchBox({ value, onChange, label, placeholder, className }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-brown-soft" strokeWidth={1.8} />
      <Input type="search" aria-label={label} placeholder={placeholder ?? label} value={value} onChange={(e) => onChange(e.target.value)} className="pl-11" />
    </div>
  );
}

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Filter buttons that read as a single choice. Uses aria-pressed, not tabs, because they filter one table. */
export function FilterChips<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: ChipOption<T>[] }) {
  return (
    <div role="group" aria-label={label} className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" data-lenis-prevent>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "press inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold whitespace-nowrap transition-colors duration-150",
              on ? "bg-cocoa text-cream" : "text-brown [@media(hover:hover)_and_(pointer:fine)]:hover:bg-cocoa/8",
            )}
          >
            {o.label}
            {o.count !== undefined ? <span className={cn("tabular text-xs", on ? "text-cream/80" : "text-brown-soft")}>{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** On/off switch with a 44px target. The label names the setting, the state is announced by role=switch. */
export function Switch({ checked, onChange, label, disabled, className }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("press group grid min-h-11 min-w-11 place-items-center rounded-full disabled:opacity-50", className)}
    >
      <span className={cn("relative block h-[26px] w-11 rounded-full transition-colors duration-150", checked ? "bg-cocoa" : "bg-line-strong")}>
        <span className={cn("absolute top-[3px] left-[3px] size-5 rounded-full bg-paper shadow-ticket transition-transform duration-150 ease-out motion-reduce:transition-none", checked && "translate-x-[18px]")} />
      </span>
    </button>
  );
}

/** Stacked rows of skeleton blocks for a loading list. */
export function ListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cn("space-y-3", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>{children}</div>;
}

export const stockOf = (p: Pick<Product, "variants">) => p.variants.reduce((s, v) => s + v.stock, 0);

export const digits = (phone: string) => phone.replace(/\D/g, "");

/** "just now", "5h ago", "3d ago", then a date. */
export function ago(iso: string, now = Date.now()) {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/**
 * Warns before losing unsaved edits: browser close/reload via beforeunload, and in-app link clicks
 * (Next's router has no navigation-blocking API, so internal anchors are intercepted in the capture phase).
 */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      if (!window.confirm("You have unsaved changes. Leave without saving?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
}

/** Destructive confirmation. Shows the API's own message when the action is refused, and stays open so the maker can read it. */
export function ConfirmModal({ open, onOpenChange, title, description, confirmLabel, cancelLabel = "Keep it", onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description: ReactNode; confirmLabel: string; cancelLabel?: string; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  async function go() {
    setBusy(true);
    setErr(undefined);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        setErr(undefined);
        onOpenChange(o);
      }}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>{cancelLabel}</Button>
          <Button className="bg-err text-cream [@media(hover:hover)_and_(pointer:fine)]:hover:bg-err/90" onClick={go} disabled={busy}>{busy ? "Working…" : confirmLabel}</Button>
        </>
      }
    >
      {err ? <ErrorNote>{err}</ErrorNote> : null}
    </Modal>
  );
}
