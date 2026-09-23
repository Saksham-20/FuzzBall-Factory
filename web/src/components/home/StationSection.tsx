import type { CSSProperties, ReactNode } from "react";
import { StationNode } from "@/components/brand/StationNode";
import { cn } from "@/lib/cn";

interface Props {
  id: string;
  n: string;
  name: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** One station on the factory floor: a thread node in the gutter, content beside it. */
export function StationSection({ id, n, name, className, style, children }: Props) {
  return (
    <section id={id} className={cn("relative overflow-x-clip pt-[clamp(4rem,8vw,7rem)] pb-[clamp(3.5rem,6.5vw,5.5rem)]", className)} style={style}>
      <div className="shell relative">
        <StationNode n={n} name={name} className="top-1 left-4 md:left-8 lg:left-12" />
        <div className="conveyor-indent">{children}</div>
      </div>
    </section>
  );
}
