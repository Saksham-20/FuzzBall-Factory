import type { CartLine } from "@/lib/types";
import { createPersistedStore } from "@/lib/store";

export const cartStore = createPersistedStore<CartLine[]>("fbf-cart-v1", []);
export const wishStore = createPersistedStore<string[]>("fbf-wish-v1", []);
