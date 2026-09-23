import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export const buttonStyles = cva(
  "press inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none transition-[background-color,box-shadow,color] duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.1em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-cocoa text-cream [@media(hover:hover)_and_(pointer:fine)]:hover:bg-brown",
        secondary:
          "bg-paper text-cocoa shadow-ticket [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-lift",
        ghost:
          "text-cocoa [@media(hover:hover)_and_(pointer:fine)]:hover:bg-cocoa/8",
        tape: "bg-butter text-cocoa [@media(hover:hover)_and_(pointer:fine)]:hover:bg-butter-deep",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6 text-[15px]",
        lg: "h-[52px] px-8 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

interface Props extends ComponentPropsWithoutRef<"button">, VariantProps<typeof buttonStyles> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: Props) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}
