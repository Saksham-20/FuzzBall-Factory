import { http, compact } from "@/lib/api/http";
import type { Address, User } from "@/lib/types";

export const updateProfile = (input: { name: string; phone?: string; email: string }) =>
  http<User>("/account/profile", { method: "PATCH", body: { name: input.name, email: input.email, phone: input.phone ?? "" } });

export const changePassword = (current: string, next: string) => http("/account/password", { method: "POST", body: { current, next } });

export const listAddresses = () => http<Address[]>("/account/addresses");

export function saveAddress(a: Omit<Address, "id"> & { id?: string }): Promise<Address> {
  const { id, ...rest } = a;
  const body = compact(rest);
  return id ? http<Address>(`/account/addresses/${encodeURIComponent(id)}`, { method: "PUT", body }) : http<Address>("/account/addresses", { method: "POST", body });
}

export const deleteAddress = (id: string) => http(`/account/addresses/${encodeURIComponent(id)}`, { method: "DELETE" });
export const requestAccountDeletion = () => http("/account/delete-request", { method: "POST" });
