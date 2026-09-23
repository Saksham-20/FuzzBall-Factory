import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  steps: string[];
  /** 0-based active step */
  current: number;
  /** Furthest step the shopper has reached; earlier ones can be revisited. */
  reached: number;
  onSelect: (i: number) => void;
}

/** The work order's progress as a length of yarn: solid rose where you've been, dotted where you're heading. */
export function ThreadStepper({ steps, current, reached, onSelect }: Props) {
  return (
    <nav aria-label="Work order steps">
      <ol className="flex">
        {steps.map((label, i) => {
          const done = i < current;
          const live = i === current;
          const last = i === steps.length - 1;
          const open = i <= reached;
          return (
            <li key={label} className="relative flex-1" aria-current={live ? "step" : undefined}>
              {!last ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-[22px] left-[calc(50%+18px)] right-[calc(-50%+18px)] border-t-[3px]",
                    done ? "border-solid border-rose" : "border-dotted border-kraft-deep/60",
                  )}
                />
              ) : null}
              <button
                type="button"
                disabled={!open || live}
                onClick={() => onSelect(i)}
                aria-label={`Step ${i + 1} of ${steps.length}: ${label}${done ? ", done" : live ? ", current" : ""}`}
                className="press group relative mx-auto flex w-full flex-col items-center gap-1 pb-1 disabled:pointer-events-none"
              >
                <span
                  className={cn(
                    "z-10 grid size-11 place-items-center",
                  )}
                >
                  <span
                    className={cn(
                      "font-stencil tabular grid size-9 place-items-center rounded-full text-[13px] transition-colors duration-150",
                      done && "bg-cocoa text-cream [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-brown",
                      live && "bg-rose-deep text-cream ring-4 ring-rose-wash",
                      !done && !live && "border-2 border-dashed border-kraft-deep bg-cream text-brown-soft",
                    )}
                  >
                    {done ? <Check className="size-4" strokeWidth={2.4} /> : i + 1}
                  </span>
                </span>
                <span className={cn("text-xs font-semibold sm:text-sm", live ? "text-cocoa" : "text-brown")}>{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
