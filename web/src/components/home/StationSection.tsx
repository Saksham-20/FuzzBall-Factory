import type { CSSProperties, ReactNode } from "react";
import { StationNode } from "@/components/brand/StationNode";
import { cn } from "@/lib/cn";

interface Props {
  id: string;
  n: string;
  name: string;
  /** Id of the station's heading: it names the section, so screen readers list it as a region. */
  headingId: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * One station on the factory floor: a thread node in the gutter, content beside it. Every station takes half the
 * section token above and below, so two stations always sit one token apart (a band with its own ground, like Work
 * Orders, pads itself with the whole token instead).
 */
export function StationSection({ id, n, name, headingId, className, style, children }: Props) {
  return (
    <section id={id} aria-labelledby={headingId} className={cn("relative overflow-x-clip py-[calc(var(--spacing-section)/2)]", className)} style={style}>
      <div className="shell relative">
        <StationNode n={n} name={name} className="top-1 left-1.5 min-[30rem]:left-4 md:left-8 lg:left-12" />
        <div className="conveyor-indent">{children}</div>
      </div>
    </section>
  );
}
