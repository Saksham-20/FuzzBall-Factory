import { describe, expect, it } from "vitest";
import { catmullRom, crossStitches, flatten, lengthAtY, pointAt, toPathData, type Cubic, type Pt } from "./thread-geometry";

/** A straight segment as a cubic, control points a third of the way along. */
const straight = (a: Pt, b: Pt): Cubic => [
  a,
  [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3],
  [a[0] + ((b[0] - a[0]) * 2) / 3, a[1] + ((b[1] - a[1]) * 2) / 3],
  b,
];

describe("catmullRom", () => {
  it("passes through every point, one cubic per gap", () => {
    const pts: Pt[] = [
      [0, 0],
      [10, 40],
      [-5, 90],
      [3, 140],
    ];
    const curves = catmullRom(pts);
    expect(curves).toHaveLength(3);
    curves.forEach((c, i) => {
      expect(c[0]).toEqual(pts[i]);
      expect(c[3]).toEqual(pts[i + 1]);
    });
  });
});

describe("toPathData", () => {
  it("moves to the first point, then one C per cubic", () => {
    const d = toPathData([straight([0, 0], [0, 30]), straight([0, 30], [12, 60])]);
    expect(d.startsWith("M 0.0 0.0 C")).toBe(true);
    expect(d.match(/C /g)).toHaveLength(2);
    expect(d.endsWith("12.0 60.0")).toBe(true);
  });

  it("is empty for no curves", () => {
    expect(toPathData([])).toBe("");
  });
});

describe("flatten and pointAt", () => {
  const line = flatten([straight([0, 0], [0, 300]), straight([0, 300], [400, 300])]);

  it("measures straight runs exactly", () => {
    expect(line.total).toBeCloseTo(700, 6);
  });

  it("finds the point and heading at a length", () => {
    const down = pointAt(line, 150);
    expect(down.x).toBeCloseTo(0);
    expect(down.y).toBeCloseTo(150);
    expect([down.dx, down.dy]).toEqual([expect.closeTo(0), expect.closeTo(1)]);
    const across = pointAt(line, 500);
    expect(across.x).toBeCloseTo(200);
    expect(across.y).toBeCloseTo(300);
    expect(across.dx).toBeCloseTo(1);
  });

  it("clamps lengths before the start and past the end", () => {
    expect(pointAt(line, -20)).toMatchObject({ x: 0, y: 0 });
    expect(pointAt(line, 9999)).toMatchObject({ x: expect.closeTo(400), y: expect.closeTo(300) });
  });

  it("keeps a curved run's length close to its true arc", () => {
    // A quarter circle of radius 100, as the standard cubic approximation: arc length 157.08.
    const k = 0.5523 * 100;
    const arc = flatten([
      [
        [100, 0],
        [100, k],
        [k, 100],
        [0, 100],
      ],
    ]);
    expect(arc.total).toBeGreaterThan(156.9);
    expect(arc.total).toBeLessThan(157.2);
  });
});

describe("lengthAtY", () => {
  // Down 100, back up 50, then down to 400: the climb must not count as progress twice.
  const line = flatten([straight([0, 0], [0, 100]), straight([0, 100], [0, 50]), straight([0, 50], [0, 400])]);

  it("is 0 above the start and the whole length below the end", () => {
    expect(lengthAtY(line, -10)).toBe(0);
    expect(lengthAtY(line, 500)).toBeCloseTo(line.total);
  });

  it("returns the first length that reaches a height", () => {
    expect(lengthAtY(line, 80)).toBeCloseTo(80, 4);
    // 120 is first reached after the dip: 100 down, 50 up, then 70 more down.
    expect(lengthAtY(line, 120)).toBeCloseTo(220, 4);
  });

  it("never runs backwards as the height grows", () => {
    let last = 0;
    for (let y = 0; y <= 400; y += 7) {
      const l = lengthAtY(line, y);
      expect(l).toBeGreaterThanOrEqual(last - 1e-9);
      last = l;
    }
  });
});

describe("crossStitches", () => {
  it("lays one x every gap along the line, short of the very end", () => {
    const line = flatten([straight([0, 0], [0, 260])]);
    const d = crossStitches(line, 26, 3);
    // Two strokes per stitch, at 26, 52, … up to 234 (the last stitch stays 6px clear of the end).
    expect(d.match(/M/g)).toHaveLength(2 * 9);
  });

  it("turns each stitch to the line's heading", () => {
    const line = flatten([straight([0, 0], [100, 0])]);
    const [first] = crossStitches(line, 50, 3).split("M").filter(Boolean);
    // Heading along +x: the first stroke runs from (47,-3) to (53,3).
    expect(first).toBe("47.0 -3.0L53.0 3.0");
  });
});
