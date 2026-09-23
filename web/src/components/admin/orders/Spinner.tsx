import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

/** Inline button spinner. Still under reduced motion, the label change carries the state. */
export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden strokeWidth={1.8} className={cn("animate-spin motion-reduce:animate-none", className)} />;
}
