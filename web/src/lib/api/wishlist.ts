import { SITE } from "@/lib/site";
import * as real from "@/lib/api/real/wishlist";

/**
 * Saved pieces on the account. In mock mode the device's own list (`wishStore`) is the only copy, so there is nothing
 * to call; in real mode a signed-in shopper's list lives on the server and `wishStore` mirrors it (see CartContext).
 */
export async function mergeWishlist(productIds: string[]): Promise<string[]> {
  if (SITE.useMock) return productIds;
  return (await real.mergeWishlist(productIds)).map((e) => e.productId);
}

/** The account's list, oldest first. */
export async function loadWishlist(): Promise<string[]> {
  if (SITE.useMock) return [];
  return (await real.listWishlist()).map((e) => e.productId);
}

export async function saveToWishlist(productId: string): Promise<void> {
  if (!SITE.useMock) await real.addToWishlist(productId);
}

export async function removeFromWishlist(productId: string): Promise<void> {
  if (!SITE.useMock) await real.removeFromWishlist(productId);
}
