import { SITE } from "@/lib/site";
import * as real from "@/lib/api/real/account";
import { ApiError, db, wait } from "@/lib/mock/db";
import type { Address, User } from "@/lib/types";

function uid() {
  const s = db.get().session;
  if (!s) throw new ApiError(401, "Please log in.");
  return s.userId;
}

export async function updateProfile(input: { name: string; phone?: string; currentPassword?: string }): Promise<User> {
  if (!SITE.useMock) return real.updateProfile(input);
  await wait();
  const id = uid();
  const { name, phone } = input;
  db.update((d) => ({ ...d, users: d.users.map((u) => (u.id === id ? { ...u, name, phone } : u)) }));
  const { password, ...u } = db.get().users.find((x) => x.id === id)!;
  void password;
  return u;
}

/** Mock: checks the password and reports success; there is no inbox to confirm from, so the address stays put. */
export async function changeEmail(email: string, password: string): Promise<void> {
  if (!SITE.useMock) return real.changeEmail(email, password);
  await wait();
  const u = db.get().users.find((x) => x.id === uid())!;
  if (u.password !== password) throw new ApiError(400, "That password isn't right.", { password: "Incorrect" });
  if (email.trim().toLowerCase() === u.email.toLowerCase()) throw new ApiError(400, "That is already your email.", { email: "Same as now" });
}

export async function changePassword(current: string, next: string): Promise<void> {
  if (!SITE.useMock) return real.changePassword(current, next);
  await wait();
  const id = uid();
  const u = db.get().users.find((x) => x.id === id)!;
  if (u.password !== current) throw new ApiError(400, "Your current password isn't right.", { current: "Incorrect" });
  if (next.length < 8) throw new ApiError(400, "Use at least 8 characters.", { next: "Too short" });
  db.update((d) => ({ ...d, users: d.users.map((x) => (x.id === id ? { ...x, password: next } : x)) }));
}

export async function listAddresses(): Promise<Address[]> {
  if (!SITE.useMock) return real.listAddresses();
  await wait(200);
  const id = uid();
  const d = db.get();
  return d.addresses.filter((a) => d.addressOwner[a.id] === id);
}

export async function saveAddress(a: Omit<Address, "id"> & { id?: string }): Promise<Address> {
  if (!SITE.useMock) return real.saveAddress(a);
  await wait();
  const id = uid();
  const addr: Address = { ...a, id: a.id ?? `a${Date.now()}` };
  db.update((d) => {
    let list = d.addresses.some((x) => x.id === addr.id) ? d.addresses.map((x) => (x.id === addr.id ? addr : x)) : [...d.addresses, addr];
    const mineIds = list.filter((x) => (x.id === addr.id ? true : d.addressOwner[x.id] === id)).map((x) => x.id);
    const first = mineIds.length === 1;
    if (addr.isDefault || first) list = list.map((x) => (mineIds.includes(x.id) ? { ...x, isDefault: x.id === addr.id } : x));
    return { ...d, addresses: list, addressOwner: { ...d.addressOwner, [addr.id]: id } };
  });
  return db.get().addresses.find((x) => x.id === addr.id)!;
}

export async function deleteAddress(addressId: string): Promise<void> {
  if (!SITE.useMock) return real.deleteAddress(addressId);
  await wait(250);
  const id = uid();
  db.update((d) => (d.addressOwner[addressId] === id ? { ...d, addresses: d.addresses.filter((a) => a.id !== addressId) } : d));
}

/** DPDP Act: account deletion request, fulfilled within 30 days. */
export async function requestAccountDeletion(): Promise<void> {
  if (!SITE.useMock) return real.requestAccountDeletion();
  await wait(400);
  const id = uid();
  db.update((d) => ({ ...d, users: d.users.map((u) => (u.id === id && !u.deletionRequestedAt ? { ...u, deletionRequestedAt: new Date().toISOString() } : u)) }));
}

/** Withdraws a pending deletion request. */
export async function cancelAccountDeletion(): Promise<void> {
  if (!SITE.useMock) return real.cancelAccountDeletion();
  await wait(300);
  const id = uid();
  db.update((d) => ({ ...d, users: d.users.map((u) => (u.id === id ? { ...u, deletionRequestedAt: undefined } : u)) }));
}

/** DPDP right of access: everything held about the signed-in account, as a plain object (the caller offers it as a file). */
export async function exportData(): Promise<Record<string, unknown>> {
  if (!SITE.useMock) return real.exportData();
  await wait(300);
  const id = uid();
  const d = db.get();
  const { password, ...profile } = d.users.find((u) => u.id === id)!;
  void password;
  return {
    generatedAt: new Date().toISOString(),
    about: "Everything held about this account (sample data in this preview).",
    profile,
    addresses: d.addresses.filter((a) => d.addressOwner[a.id] === id),
    orders: d.orders.filter((o) => o.userId === id),
  };
}
