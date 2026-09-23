import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

const badge = cva(
  "font-stencil tabular inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] leading-none",
  {
    variants: {
      tone: {
        ready: "bg-ok-wash text-ok",
        mto: "bg-warn-wash text-warn",
        ooak: "bg-butter text-cocoa",
        sold: "bg-cocoa text-cream",
        err: "bg-err-wash text-err",
        /** Dev-only marker for sample data: dashed so it can't pass for a real status. */
        sample: "border border-dashed border-brown-soft bg-paper/80 text-brown",
      },
    },
    defaultVariants: { tone: "ready" },
  },
);

interface Props extends ComponentPropsWithoutRef<"span">, VariantProps<typeof badge> {}

export function Badge({ tone, className, ...props }: Props) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}
