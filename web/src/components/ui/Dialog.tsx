"use client";

import type { ReactNode } from "react";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

const overlay = "fixed inset-0 z-50 bg-cocoa/45 data-[state=closed]:animate-[fade-out_200ms_ease-out_forwards] data-[state=open]:animate-[fade-in_250ms_ease-out]";

/** Centered dialog. Use only when focus must be protected: confirmations and short decisions. */
export function Modal({ open, onOpenChange, title, description, children, footer, className }: Props) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className={overlay} />
        <D.Content
          aria-describedby={description ? undefined : undefined}
          className={cn("fixed top-1/2 left-1/2 z-50 max-h-[88dvh] w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-ticket bg-paper p-6 shadow-lift outline-none data-[state=closed]:animate-[fade-out_160ms_ease-out_forwards] data-[state=open]:animate-[pop-in_200ms_var(--ease-out)]", className)}
        >
          <D.Title className="font-display text-[1.9rem]">{title}</D.Title>
          {description ? <D.Description className="mt-2 text-brown">{description}</D.Description> : null}
          {children ? <div className="mt-4">{children}</div> : null}
          {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
          <D.Close aria-label="Close" className="press absolute top-3 right-3 grid size-11 place-items-center rounded-full hover:bg-cocoa/8">
            <X className="size-5" />
          </D.Close>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Side sheet (right on desktop, full width on phones). For forms and filters. */
export function Drawer({ open, onOpenChange, title, description, children, footer, className }: Props) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className={overlay} />
        <D.Content
          aria-describedby={description ? undefined : undefined}
          className={cn("fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col bg-paper shadow-lift outline-none data-[state=closed]:animate-[drawer-out_240ms_var(--ease-drawer)_forwards] data-[state=open]:animate-[drawer-in_380ms_var(--ease-drawer)]", className)}
        >
          <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
            <div>
              <D.Title className="font-display text-[2rem]">{title}</D.Title>
              {description ? <D.Description className="mt-1 text-brown">{description}</D.Description> : null}
            </div>
            <D.Close aria-label="Close" className="press grid size-11 shrink-0 place-items-center rounded-full hover:bg-cocoa/8">
              <X className="size-5" />
            </D.Close>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-2" data-lenis-prevent>
            {children}
          </div>
          {footer ? <footer className="flex flex-wrap justify-end gap-2 border-t border-line bg-cream px-5 py-4">{footer}</footer> : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
