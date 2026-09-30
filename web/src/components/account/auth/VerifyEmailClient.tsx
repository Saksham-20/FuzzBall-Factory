"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { HookSpinner } from "@/components/ui/misc";
import { verifyEmail } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { useAuth } from "@/lib/state/AuthContext";

type State = { kind: "working" } | { kind: "done"; purpose: "VERIFY" | "CHANGE" } | { kind: "failed"; message: string };

/** Consumes the emailed link on arrival. The token works once, so the request is guarded against a double effect. */
export function VerifyEmailClient({ token }: { token?: string }) {
  const { refresh } = useAuth();
  const [state, setState] = useState<State>(token ? { kind: "working" } : { kind: "failed", message: "This link is missing its token. Open it straight from the email." });
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verifyEmail(token)
      .then(async (r) => {
        if (r.purpose === "VERIFY") await refresh().catch(() => undefined);
        setState({ kind: "done", purpose: r.purpose });
      })
      .catch((e: unknown) => setState({ kind: "failed", message: e instanceof ApiError ? e.message : "We couldn't confirm that just now. Please try again in a moment." }));
  }, [token, refresh]);

  if (state.kind === "working") {
    return (
      <div role="status" aria-live="polite">
        <h1 className="font-display text-[clamp(2.75rem,8vw,3.75rem)]">Confirming…</h1>
        <HookSpinner className="mt-6" label="Confirming your email" />
      </div>
    );
  }
  if (state.kind === "done") {
    const changed = state.purpose === "CHANGE";
    return (
      <div role="status" aria-live="polite">
        <h1 className="font-display text-[clamp(2.75rem,8vw,3.75rem)]">{changed ? "Email updated" : "Email confirmed"}</h1>
        <p className="mt-3 max-w-[46ch] text-brown">
          {changed ? "Your account now uses this address. For your safety every device was signed out, so log in again with the new email." : "Thanks, that's your address confirmed. You can now change your phone number or email from your profile."}
        </p>
        <Button asChild className="mt-8">
          <Link href={changed ? "/login" : "/account"}>{changed ? "Log in" : "Go to my account"}</Link>
        </Button>
      </div>
    );
  }
  return (
    <div role="alert">
      <h1 className="font-display text-[clamp(2.75rem,8vw,3.75rem)]">Link didn&apos;t work</h1>
      <p className="mt-3 max-w-[46ch] text-brown">{state.message}</p>
      <Button asChild className="mt-8">
        <Link href="/account/profile">Open my profile</Link>
      </Button>
    </div>
  );
}
