import { http, compact } from "@/lib/api/http";
import { ApiError } from "@/lib/api/errors";
import type { User } from "@/lib/types";

const ROLE_HINT = "fbf_role";
const hasRoleHint = () => typeof document === "undefined" || document.cookie.split("; ").some((c) => c.startsWith(`${ROLE_HINT}=`));

/**
 * Current user, or null when logged out. `fbf_role` is the client-set hint cookie (see AuthContext): without it
 * nobody has logged in on this browser, so skip the round trip (and the guaranteed 401) for anonymous visitors.
 */
export async function me(): Promise<User | null> {
  if (!hasRoleHint()) return null;
  try {
    return await http<User>("/auth/me");
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export const login = (input: { identifier: string; password: string }) =>
  http<User>("/auth/login", { method: "POST", body: { identifier: input.identifier.trim(), password: input.password } });

export const signup = (input: { name: string; email: string; phone?: string; password: string }) =>
  http<User>("/auth/signup", { method: "POST", body: compact({ name: input.name.trim(), email: input.email.trim(), phone: input.phone?.trim() || undefined, password: input.password }) });

export async function logout(): Promise<void> {
  try {
    await http("/auth/logout", { method: "POST", noRefresh: true });
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 401)) throw e; // already signed out
  }
}

export const forgotPassword = (email: string) => http("/auth/forgot", { method: "POST", body: { email: email.trim() } });
export const resetPassword = (token: string, password: string) => http("/auth/reset", { method: "POST", body: { token, password } });
