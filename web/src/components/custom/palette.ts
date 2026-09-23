import type { Swatch } from "@/lib/types";

/** Yarn colours offered on the work order form (a starting point, free text covers the rest). */
export const CUSTOM_PALETTE: Swatch[] = [
  { name: "Cream", hex: "#f1e4d3" },
  { name: "Dusty rose", hex: "#c98586" },
  { name: "Peach", hex: "#f0b59a" },
  { name: "Cherry", hex: "#c9403f" },
  { name: "Marigold", hex: "#ee9a2a" },
  { name: "Butter", hex: "#f4cd52" },
  { name: "Sage", hex: "#8fa876" },
  { name: "Mint", hex: "#a8c9b0" },
  { name: "Navy", hex: "#2f3f66" },
  { name: "Lilac", hex: "#b9a3d3" },
  { name: "Cocoa", hex: "#6b4228" },
  { name: "Black", hex: "#2a2422" },
];

/** Palette plus any extra swatches (e.g. from the base product), without duplicates. */
export function mergePalette(extra: Swatch[] = []): Swatch[] {
  const seen = new Set(CUSTOM_PALETTE.map((s) => s.name.toLowerCase()));
  return [...CUSTOM_PALETTE, ...extra.filter((s) => !seen.has(s.name.toLowerCase()))];
}
