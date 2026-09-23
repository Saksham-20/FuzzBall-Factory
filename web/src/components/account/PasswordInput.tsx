"use client";

import { forwardRef, useState, type ComponentPropsWithoutRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

/** Password field with a show/hide toggle. Accepts the same props as `Input` (incl. the Field wiring). */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<ComponentPropsWithoutRef<"input">, "type">>(function PasswordInput({ className, ...p }, ref) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={shown ? "text" : "password"} autoCapitalize="none" spellCheck={false} className={cn("pr-14", className)} {...p} />
      <button
        type="button"
        aria-pressed={shown}
        aria-label={shown ? "Hide password" : "Show password"}
        onClick={() => setShown((s) => !s)}
        className="press absolute top-0.5 right-0.5 grid size-11 place-items-center rounded-full text-brown [@media(hover:hover)_and_(pointer:fine)]:hover:bg-cocoa/8"
      >
        {shown ? <EyeOff className="size-5" strokeWidth={1.8} /> : <Eye className="size-5" strokeWidth={1.8} />}
      </button>
    </div>
  );
});
