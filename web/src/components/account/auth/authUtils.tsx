"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { HookSpinner } from "@/components/ui/misc";
import { useAuth } from "@/lib/state/AuthContext";
import { ApiError } from "@/lib/mock/db";
import type { User } from "@/lib/types";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

/** Only same-site paths: must start with "/" and not "//" or "/\". */
export function safeNext(next?: string | null): string | undefined {
  if (!next) return undefined;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return undefined;
  return next;
}

/** Where to send someone after they sign in. Never send a customer to /admin (it would bounce them back here). */
export function destinationFor(user: User, next?: string | null): string {
  const n = safeNext(next);
  if (user.role === "admin") return n ?? "/admin";
  if (!n || n === "/admin" || n.startsWith("/admin/")) return "/account";
  return n;
}

/** Copy an ApiError onto the form. Returns the message to show above the form (empty when a field error already says it). */
export function applyApiError<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, known: readonly string[]): string {
  if (err instanceof ApiError) {
    let placed = false;
    for (const [k, v] of Object.entries(err.fields ?? {})) {
      if (known.includes(k)) {
        setError(k as Path<T>, { message: v });
        placed = true;
      }
    }
    return placed ? "" : err.message;
  }
  return "Something went wrong on our side. Please try again in a moment.";
}

/**
 * Login/signup shell: if the visitor is already signed in, send them on instead of showing the form.
 * Shows the loader while redirecting (also right after a successful submit, so nothing double-submits).
 */
export function GuestOnly({ next, signedInTo, children }: { next?: string; signedInTo?: string; children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const target = user ? (signedInTo ?? destinationFor(user, next)) : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (user) {
    return (
      <div className="grid min-h-48 place-items-center">
        <HookSpinner label="Taking you to your account" />
      </div>
    );
  }
  return <>{children}</>;
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-[12px] bg-err-wash px-4 py-3 text-[15px] font-medium text-err">
      {children}
    </div>
  );
}
