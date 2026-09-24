import { describe, expect, it } from "vitest";
import { AXES, WRAPS, band, range, strand, unit } from "./yarn-geometry";

const C = 200;
const R = 190;

/** End points of the M and A commands in a path (with Z, the only commands these paths use). */
const endpoints = (d: string) =>
  [...d.matchAll(/[MA]([^MAZ]+)/g)].map((m) => m[1].trim().split(/[\s,]+/).map(Number).slice(-2) as [number, number]);

/** End points of the arcs that run along the ball's own rim. */
const rimEnds = (d: string) =>
  [...d.matchAll(new RegExp(`A${R} ${R} 0 [01] [01] (-?[\\d.]+) (-?[\\d.]+)`, "g"))].map((m) => [Number(m[1]), Number(m[2])] as const);

const fromCentre = ([x, y]: readonly [number, number]) => Math.hypot(x - C, y - C);

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
    it(`${detail} detail: every path is finite and stays on the ball`, () => {
      const paths = WRAPS[detail].layers.flatMap((l) => [l.shadow, l.fill, ...l.strands, ...l.highlights]);
      const drawn = paths.filter((d): d is string => Boolean(d));
      expect(drawn.length).toBeGreaterThan(0);
      for (const d of drawn) {
        expect(d).not.toMatch(/NaN|Infinity/);
        // Rounded to 0.1, so allow half a unit past the rim.
        for (const p of endpoints(d)) expect(fromCentre(p)).toBeLessThanOrEqual(R + 0.5);
      }
    });

    it(`${detail} detail: every band has its shadow`, () => {
      // YarnBall draws nothing for a missing shadow, so losing one would go unseen.
      for (const l of WRAPS[detail].layers) if (l.fill) expect(l.shadow).toBeTruthy();
    });

    it(`${detail} detail: every band and its shadow close along the rim`, () => {
      const bands = WRAPS[detail].layers.flatMap((l) => [l.fill, l.shadow]).filter((d): d is string => Boolean(d));
      expect(bands.length).toBeGreaterThan(0);
      for (const d of bands) {
        const ends = rimEnds(d);
        expect(ends).toHaveLength(2);
        for (const p of ends) expect(Math.abs(fromCentre(p) - R)).toBeLessThan(0.2);
      }
    });
  }
});
