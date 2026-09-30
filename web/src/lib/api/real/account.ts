import { http, compact } from "@/lib/api/http";
import type { Address, User } from "@/lib/types";

export const updateProfile = (input: { name: string; phone?: string; currentPassword?: string }) =>
  http<User>("/account/profile", { method: "PATCH", body: compact({ name: input.name, phone: input.phone ?? "", currentPassword: input.currentPassword || undefined }) });

/** Sends a confirm link to the new address; the account only moves when it is used. */
export const changeEmail = (email: string, password: string) => http("/account/email-change", { method: "POST", body: { email: email.trim(), password } });

export const changePassword = (current: string, next: string) => http("/account/password", { method: "POST", body: { current, next } });

export const listAddresses = () => http<Address[]>("/account/addresses");

export function saveAddress(a: Omit<Address, "id"> & { id?: string }): Promise<Address> {
  const { id, ...rest } = a;
  const body = compact(rest);
  return id ? http<Address>(`/account/addresses/${encodeURIComponent(id)}`, { method: "PUT", body }) : http<Address>("/account/addresses", { method: "POST", body });
}

export const deleteAddress = (id: string) => http(`/account/addresses/${encodeURIComponent(id)}`, { method: "DELETE" });
export const requestAccountDeletion = () => http("/account/delete-request", { method: "POST" });
