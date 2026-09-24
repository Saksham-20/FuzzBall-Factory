import { describe, expect, it } from "vitest";
import { AXES, WRAPS, band, range, strand, unit } from "./yarn-geometry";

const numbersIn = (d: string) => (d.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? []).map(Number);

describe("range", () => {
  it("spreads count values from one end to the other", () => {
    expect(range(-1, 1, 5)).toEqual([-1, -0.5, 0, 0.5, 1]);
  });

  it("centres a single value instead of dividing by zero", () => {
    const one = range(0.2, 0.4, 1);
    expect(one).toHaveLength(1);
    expect(one[0]).toBeCloseTo(0.3);
  });
});

describe("strand", () => {
  it("refuses an axis pointing straight out of the page", () => {
    expect(() => strand([0, 0, 1], 0)).toThrow(/straight out of the page/);
  });

  it("has nothing to draw at the pole", () => {
    expect(strand(AXES.base, 0.99999)).toBeNull();
  });

  it("draws the front of the equator as one arc between two rim points", () => {
    const s = strand(AXES.base, 0);
    expect(s?.d).toMatch(/^M[\d.]+ [\d.]+A/);
    expect(s?.a).toBeDefined();
    expect(s?.b).toBeDefined();
  });
});

describe("band", () => {
  it("closes along the rim", () => {
    const d = band(AXES.cross, 0.2);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d.match(/A190 190/g)).toHaveLength(2);
  });

  it("fails loudly when an edge never reaches the rim", () => {
    // Tilted almost straight at the viewer: one edge is a whole ellipse on the front, the other hidden.
    expect(() => band(unit([0.05, 0, 1]), 0.2)).toThrow(/doesn't reach the rim/);
  });
});

describe("WRAPS", () => {
  for (const detail of ["full", "low"] as const) {
    it(`${detail} detail: every path is finite and inside the ball's box`, () => {
      const paths = WRAPS[detail].layers.flatMap((l) => [l.shadow, l.fill, ...l.strands, ...l.highlights]);
      const drawn = paths.filter((d): d is string => Boolean(d));
      expect(drawn.length).toBeGreaterThan(0);
      for (const d of drawn) {
        expect(d).not.toMatch(/NaN|Infinity/);
        for (const n of numbersIn(d)) expect(Math.abs(n)).toBeLessThanOrEqual(400);
      }
    });

    it(`${detail} detail: every band has its shadow`, () => {
      for (const l of WRAPS[detail].layers) if (l.fill) expect(l.shadow).toBeTruthy();
    });
  }
});
