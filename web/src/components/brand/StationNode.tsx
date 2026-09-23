import { cn } from "@/lib/cn";

interface Props {
  n: string;
  name: string;
  className?: string;
}

/**
 * Numbered node on the conveyor thread. The conveyor reads its position from
 * `data-station-node`. The station name runs vertically beside the thread.
 */
export function StationNode({ n, name, className }: Props) {
  return (
    <div className={cn("pointer-events-none absolute z-20 flex flex-col items-center", className)}>
      <span
        data-station-node
        data-reveal="stamp"
        className="font-stencil tabular grid size-9 place-items-center rounded-full bg-cocoa text-[13px] text-cream shadow-ticket md:size-11 md:text-[15px]"
      >
        {n}
      </span>
      <span
        className="font-stencil relative left-[22px] mt-3 hidden text-[11px] whitespace-nowrap text-brown md:block"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {name}
      </span>
    </div>
  );
}
