import { SITE } from "@/lib/site";
import * as real from "@/lib/api/real/auth";
import { ApiError, db, wait } from "@/lib/mock/db";
import type { User } from "@/lib/types";

const strip = (u: User & { password?: string }): User => {
  const { password, ...rest } = u;
  void password;
  return rest;
};

export async function me(): Promise<User | null> {
  if (!SITE.useMock) return real.me();
  await wait(120);
  const d = db.get();
  const u = d.session && d.users.find((x) => x.id === d.session!.userId);
  return u ? strip(u) : null;
}

export async function login(input: { identifier: string; password: string }): Promise<User> {
  if (!SITE.useMock) return real.login(input);
  await wait();
  const id = input.identifier.trim().toLowerCase();
  const u = db.get().users.find((x) => x.email.toLowerCase() === id || x.phone === input.identifier.trim());
  if (!u || u.password !== input.password) throw new ApiError(401, "That email/phone and password don't match. Try again or reset your password.");
  db.update((d) => ({ ...d, session: { userId: u.id } }));
  return strip(u);
}

export async function signup(input: { name: string; email: string; phone?: string; password: string }): Promise<User> {
  if (!SITE.useMock) return real.signup(input);
  await wait();
  const email = input.email.trim().toLowerCase();
  if (db.get().users.some((x) => x.email.toLowerCase() === email)) {
    throw new ApiError(409, "An account with this email already exists. Try logging in.", { email: "Already registered" });
  }
  const user = { id: `u${Date.now()}`, name: input.name.trim(), email, phone: input.phone?.trim() || undefined, role: "customer" as const, createdAt: new Date().toISOString(), password: input.password };
  db.update((d) => ({ ...d, users: [...d.users, user], session: { userId: user.id } }));
  return strip(user);
}

export async function logout(): Promise<void> {
  if (!SITE.useMock) return real.logout();
  await wait(80);
  db.update((d) => ({ ...d, session: null }));
}

/** Always resolves the same way so account existence never leaks. */
export async function forgotPassword(_email: string): Promise<void> {
  if (!SITE.useMock) return real.forgotPassword(_email);
  void _email;
  await wait();
}

export async function resetPassword(_token: string, password: string): Promise<void> {
  if (!SITE.useMock) return real.resetPassword(_token, password);
  void _token;
  await wait();
  if (password.length < 8) throw new ApiError(400, "Use at least 8 characters.", { password: "Too short" });
}
