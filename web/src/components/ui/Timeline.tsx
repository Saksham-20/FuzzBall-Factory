import type { ReactNode } from "react";
import { Stamp } from "@/components/brand/Stamp";
import { CUSTOM_STATUS, ORDER_STATUS } from "@/lib/status";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { CustomStatus, OrderStatus, TimelineEvent } from "@/lib/types";

export interface TimelineStep {
  label: string;
  at?: string;
  note?: ReactNode;
  photo?: string;
}

interface Props {
  steps: TimelineStep[];
  /** Index of the step the order/work order is on now. */
  current: number;
  /** True when the next move is the customer's: the thread ends in a loose end instead of running on. */
  waiting?: boolean;
  className?: string;
}

/**
 * Vertical status thread. Solid rose = done, dashed marching = in progress,
 * dotted kraft = still to come, loose curl = waiting on you. Never colour alone: every state has its own stroke.
 */
export function Timeline({ steps, current, waiting, className }: Props) {
  return (
    <ol className={cn("relative", className)}>
      {steps.map((s, i) => {
        const done = i < current;
        const live = i === current;
        const last = i === steps.length - 1;
        return (
          <li key={s.label} className="relative flex gap-4 pb-7 last:pb-0" aria-current={live ? "step" : undefined}>
            <div className="relative flex w-7 shrink-0 flex-col items-center">
              <span
                className={cn(
                  "z-10 grid size-7 place-items-center rounded-full text-[11px] font-bold",
                  done && "bg-cocoa text-cream",
                  live && "bg-rose-deep text-cream ring-4 ring-rose-wash",
                  !done && !live && "border-2 border-dashed border-kraft-deep bg-cream text-brown-soft",
                )}
              >
                {done ? "✓" : i + 1}
              </span>
              {!last ? (
                <svg aria-hidden className="absolute top-7 bottom-[-1.75rem] left-1/2 w-3 -translate-x-1/2" preserveAspectRatio="none" viewBox="0 0 12 100">
                  {done ? (
                    <path d="M6 0 V100" stroke="#c98586" strokeWidth="4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  ) : live ? (
                    waiting ? (
                      <path d="M6 0 V40" stroke="#c98586" strokeWidth="4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    ) : (
                      <path className="thread-march" d="M6 0 V100" stroke="#c98586" strokeWidth="4" strokeDasharray="10 8" vectorEffect="non-scaling-stroke" />
                    )
                  ) : (
                    <path d="M6 0 V100" stroke="#a8804f" strokeOpacity="0.55" strokeWidth="3" strokeDasharray="1 9" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  )}
                </svg>
              ) : null}
              {live && waiting && !last ? (
                <svg aria-hidden viewBox="0 0 24 24" className="absolute top-[3.3rem] left-1/2 size-6 -translate-x-1/2" fill="none" stroke="#c98586" strokeWidth="3.5" strokeLinecap="round">
                  <path d="M12 0 C12 8 4 8 6 15 C8 21 17 19 15 13" />
                </svg>
              ) : null}
            </div>
            <div className={cn("min-w-0 flex-1 pt-0.5", !done && !live && "opacity-60")}>
              <p className={cn("font-semibold", live && "text-rose-deep")}>
                {s.label}
                {live ? <span className="sr-only"> (current)</span> : null}
              </p>
              {s.at ? <p className="tabular text-sm text-brown-soft">{formatDate(s.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p> : null}
              {s.note ? <p className="mt-1 text-[15px] text-brown">{s.note}</p> : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.photo ? <img src={s.photo} alt="Progress photo" className="mt-2 aspect-[4/3] w-44 rounded-[10px] object-cover" /> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Newest-first activity log with a stamp per event. */
export function EventLog({ events, kind }: { events: TimelineEvent[]; kind: "order" | "custom" }) {
  const meta = (s: string) => (kind === "order" ? ORDER_STATUS[s as OrderStatus] : CUSTOM_STATUS[s as CustomStatus]);
  return (
    <ol className="divide-y divide-line">
      {[...events].reverse().map((e, i) => {
        const m = meta(e.status);
        return (
          <li key={i} className="flex items-start gap-3 py-3">
            <Stamp label={m?.label ?? e.status.replaceAll("_", " ")} tone={m?.tone ?? "ink"} shape={m?.shape ?? "rect"} rotate={i % 2 ? 2 : -2} className="shrink-0 scale-90" />
            <div className="min-w-0">
              <p className="tabular text-sm text-brown-soft">{formatDate(e.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>
              {e.note ? <p className="text-[15px]">{e.note}</p> : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {e.photo ? <img src={e.photo} alt="Progress photo" className="mt-2 aspect-[4/3] w-40 rounded-[10px] object-cover" /> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
