import type { CartLine } from "@/lib/types";
import { createPersistedStore } from "@/lib/store";

export const cartStore = createPersistedStore<CartLine[]>("fbf-cart-v1", []);
export const wishStore = createPersistedStore<string[]>("fbf-wish-v1", []);
/**
 * Whose saved pieces `wishStore` holds: a user id once it mirrors that account's server list, null while it is just
 * this device's own list. Stops one person's saved pieces being merged into the next person's account on a shared device.
 */
export const wishOwnerStore = createPersistedStore<string | null>("fbf-wish-owner-v1", null);
