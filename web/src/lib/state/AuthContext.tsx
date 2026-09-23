"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as authApi from "@/lib/api/auth";
import { SESSION_EXPIRED_EVENT } from "@/lib/api/http";
import type { User } from "@/lib/types";

interface AuthApi {
  user: User | null;
  /** true until the first session check finishes */
  loading: boolean;
  login: (identifier: string, password: string) => Promise<User>;
  signup: (input: { name: string; email: string; phone?: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthApi | null>(null);

/**
 * Readable role HINT cookie so proxy.ts can do an optimistic redirect for /admin and /account (and so the real-API
 * client knows whether to ask /auth/me at all). It is set from what the API told us (login, signup, /auth/me) and is
 * NOT a credential: the httpOnly fbf_at / fbf_rt cookies are the session, and the API enforces every role check.
 */
function setRoleCookie(role: string | null) {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; secure" : "";
  document.cookie = role ? `fbf_role=${role}; path=/; max-age=2592000; samesite=lax${secure}` : `fbf_role=; path=/; max-age=0; samesite=lax${secure}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ user: User | null; loading: boolean }>({ user: null, loading: true });

  const refresh = useCallback(async () => {
    const u = await authApi.me();
    setRoleCookie(u?.role ?? null);
    setState({ user: u, loading: false });
  }, []);

  useEffect(() => {
    let alive = true;
    authApi.me().then((u) => {
      if (!alive) return;
      setRoleCookie(u?.role ?? null);
      setState({ user: u, loading: false });
    });
    return () => {
      alive = false;
    };
  }, []);

  // Real API: a request got a 401 and the silent refresh failed, so the session is gone.
  useEffect(() => {
    const onExpired = () => {
      setRoleCookie(null);
      setState({ user: null, loading: false });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const value = useMemo<AuthApi>(
    () => ({
      user: state.user,
      loading: state.loading,
      refresh,
      async login(identifier, password) {
        const u = await authApi.login({ identifier, password });
        setRoleCookie(u.role);
        setState({ user: u, loading: false });
        return u;
      },
      async signup(input) {
        const u = await authApi.signup(input);
        setRoleCookie(u.role);
        setState({ user: u, loading: false });
        return u;
      },
      async logout() {
        await authApi.logout();
        setRoleCookie(null);
        setState({ user: null, loading: false });
      },
    }),
    [state, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
