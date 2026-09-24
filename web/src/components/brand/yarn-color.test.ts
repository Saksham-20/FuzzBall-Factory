import { describe, expect, it } from "vitest";
import { mix, shadesOf, toHex6 } from "./yarn-color";

const brightness = (hex: string) => [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0);

describe("toHex6", () => {
  it("keeps #rrggbb as it is", () => {
    expect(toHex6("#A1b2C3")).toBe("#A1b2C3");
  });

  it("expands #rgb", () => {
    expect(toHex6("#fa0")).toBe("#ffaa00");
  });

  it.each(["red", "rgb(1, 2, 3)", "#abcd", "#ggg", "f4cd52", ""])("rejects %j", (value) => {
    expect(toHex6(value)).toBeNull();
  });
});

describe("mix", () => {
  it("returns either end at t = 0 and t = 1", () => {
    expect(mix("#3f2619", "#fcf8f2", 0)).toBe("#3f2619");
    expect(mix("#3f2619", "#fcf8f2", 1)).toBe("#fcf8f2");
  });

  it("rounds each channel", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});

describe("shadesOf", () => {
  it("darkens toward cocoa and lightens toward paper", () => {
    const s = shadesOf("#f4cd52");
    expect(s?.base).toBe("#f4cd52");
    expect(brightness(s!.dark)).toBeLessThan(brightness(s!.base));
    expect(brightness(s!.light)).toBeGreaterThan(brightness(s!.base));
  });

  it("accepts shorthand", () => {
    expect(shadesOf("#fff")?.base).toBe("#ffffff");
  });

  it("gives up on anything that isn't hex, so the ball falls back to its tone", () => {
    expect(shadesOf("tomato")).toBeNull();
  });
});
