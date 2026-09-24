/** #rgb or #rrggbb as #rrggbb; null for anything else (names, rgb(), typos). */
export function toHex6(hex: string) {
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  if (/^#[0-9a-f]{3}$/i.test(hex)) return `#${[...hex.slice(1)].map((d) => d + d).join("")}`;
  return null;
}

/** Mix two #rrggbb colours: `t` of the way from `a` to `b`. */
export function mix(a: string, b: string, t: number) {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Shades for any yarn colour: shadow mixed toward cocoa ink, highlight toward paper. Null if it isn't hex. */
export function shadesOf(color: string) {
  const hex = toHex6(color);
  return hex ? { base: hex, dark: mix(hex, "#3f2619", 0.3), light: mix(hex, "#fcf8f2", 0.38) } : null;
}
