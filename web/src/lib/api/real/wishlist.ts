import { http } from "@/lib/api/http";

export interface WishlistEntry {
  productId: string;
  addedAt: string;
}

export const listWishlist = () => http<WishlistEntry[]>("/wishlist");
export const addToWishlist = (productId: string) => http<void>(`/wishlist/${encodeURIComponent(productId)}`, { method: "PUT" });
export const removeFromWishlist = (productId: string) => http<void>(`/wishlist/${encodeURIComponent(productId)}`, { method: "DELETE" });
/** Folds the pieces saved on this device while signed out into the account; resolves with the whole account list. */
export const mergeWishlist = (productIds: string[]) => http<WishlistEntry[]>("/wishlist/merge", { method: "POST", body: { productIds } });
