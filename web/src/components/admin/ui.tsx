import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Page frame for every admin screen: title row, optional actions, body. */
export function AdminPage({ title, actions, children, className }: { title: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[clamp(2rem,4.5vw,3rem)]">{title}</h1>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

/** A plain paper surface. Elevation is the shadow only: no border. */
export function Panel({ title, actions, children, className, flush }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={cn("rounded-ticket bg-paper shadow-ticket", className)}>
      {title ? (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <h2 className="text-lg font-bold tracking-[-0.01em]">{title}</h2>
          {actions}
        </header>
      ) : null}
      <div className={flush ? "" : "px-5 pt-2 pb-5"}>{children}</div>
    </section>
  );
}

/** Horizontally scrollable table wrapper so wide tables work on phones. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto" data-lenis-prevent><table className="w-full min-w-[640px] border-collapse text-left text-[15px]">{children}</table></div>;
}
export function Th({ className, ...p }: ComponentPropsWithoutRef<"th">) {
  return <th scope="col" className={cn("font-stencil border-b border-line px-4 py-3 text-[11px] text-brown-soft", className)} {...p} />;
}
export function Td({ className, ...p }: ComponentPropsWithoutRef<"td">) {
  return <td className={cn("border-b border-line px-4 py-3 align-middle", className)} {...p} />;
}
