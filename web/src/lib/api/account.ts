import { SITE } from "@/lib/site";
import * as real from "@/lib/api/real/account";
import { ApiError, db, wait } from "@/lib/mock/db";
import type { Address, User } from "@/lib/types";

function uid() {
  const s = db.get().session;
  if (!s) throw new ApiError(401, "Please log in.");
  return s.userId;
}

export async function updateProfile(input: { name: string; phone?: string; email: string }): Promise<User> {
  if (!SITE.useMock) return real.updateProfile(input);
  await wait();
  const id = uid();
  db.update((d) => ({ ...d, users: d.users.map((u) => (u.id === id ? { ...u, ...input } : u)) }));
  const { password, ...u } = db.get().users.find((x) => x.id === id)!;
  void password;
  return u;
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
  uid();
}
