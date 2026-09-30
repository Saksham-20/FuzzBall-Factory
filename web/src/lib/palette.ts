import type { Swatch } from "@/lib/types";

/** Colour swatches offered in the shop filter: the palette of the pieces on a shelf, first occurrence wins. */
export function paletteOf(products: { swatches: Swatch[] }[]): Swatch[] {
  const seen = new Map<string, Swatch>();
  for (const p of products) for (const sw of p.swatches) if (!seen.has(sw.name)) seen.set(sw.name, sw);
  return [...seen.values()];
}
