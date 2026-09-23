"use client";

import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export const controlStyles =
  "w-full rounded-[12px] border-[1.5px] border-line-strong bg-paper px-4 text-base text-cocoa placeholder:text-brown-soft/80 transition-colors duration-150 focus-visible:border-rose-deep focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55 aria-[invalid=true]:border-err";

export const Input = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input">>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(controlStyles, "h-12", className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentPropsWithoutRef<"textarea">>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(controlStyles, "min-h-28 py-3 leading-relaxed", className)} {...p} />;
});

/** Native select: best mobile behaviour and accessibility, styled to match. */
export const Select = forwardRef<HTMLSelectElement, ComponentPropsWithoutRef<"select">>(function Select({ className, children, ...p }, ref) {
  return (
    <select ref={ref} className={cn(controlStyles, "h-12 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236b4228%22 stroke-width=%222.4%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10", className)} {...p}>
      {children}
    </select>
  );
});

export const Checkbox = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input"> & { label: ReactNode }>(function Checkbox({ label, className, id, ...p }, ref) {
  const auto = useId();
  const cid = id ?? auto;
  return (
    <label htmlFor={cid} className={cn("flex min-h-11 cursor-pointer items-start gap-3 py-1.5 text-[15px] leading-snug", className)}>
      <input ref={ref} id={cid} type="checkbox" className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-[6px] accent-cocoa" {...p} />
      <span>{label}</span>
    </label>
  );
});

export const Radio = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input"> & { label: ReactNode; description?: ReactNode }>(function Radio({ label, description, className, id, ...p }, ref) {
  const auto = useId();
  const rid = id ?? auto;
  return (
    <label htmlFor={rid} className={cn("flex min-h-12 cursor-pointer items-start gap-3 rounded-[12px] border-[1.5px] border-line-strong bg-paper p-3.5 has-[:checked]:border-cocoa has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55", className)}>
      <input ref={ref} id={rid} type="radio" className="mt-1 size-4 shrink-0 cursor-pointer accent-cocoa" {...p} />
      <span>
        <span className="block font-semibold">{label}</span>
        {description ? <span className="mt-0.5 block text-sm text-brown">{description}</span> : null}
      </span>
    </label>
  );
});

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  /** Render-prop that receives the wiring props for the control. */
  children: (p: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}

/** Label + control + hint + error, with aria wiring. Works with react-hook-form via `{...register()}` on the control. */
export function Field({ label, hint, error, optional, className, children }: FieldProps) {
  const id = useId();
  const hid = `${id}-hint`;
  const eid = `${id}-err`;
  const described = [hint ? hid : null, error ? eid : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-semibold">
        <span>{label}</span>
        {optional ? <span className="text-xs font-normal text-brown-soft">Optional</span> : null}
      </label>
      {children({ id, "aria-describedby": described, "aria-invalid": error ? true : undefined })}
      {hint && !error ? (
        <p id={hid} className="mt-1.5 text-sm text-brown">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={eid} role="alert" className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-err">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
