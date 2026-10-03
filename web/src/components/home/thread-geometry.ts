/**
 * The conveyor thread's route as plain geometry, so the page never has to ask the browser to measure the path.
 * `getPointAtLength` walks the path from its start on every call; the few thousand calls a route needs froze a
 * mid-range phone for well over a second. Here the route is a run of cubic Béziers, flattened once into a
 * polyline that answers "where is the thread at length L" and "how far along is it at height y" by binary search.
 */

export type Pt = readonly [number, number];
/** A cubic Bézier: start, two control points, end. */
export type Cubic = readonly [Pt, Pt, Pt, Pt];

/** Uniform Catmull-Rom through the points, as cubic Béziers: the route's gentle handmade wobble. */
export function catmullRom(pts: readonly Pt[]): Cubic[] {
  const out: Cubic[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    out.push([
      p1,
      [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
      [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
      p2,
    ]);
  }
  return out;
}

const f = (n: number) => n.toFixed(1);

/** SVG path data for a run of joined cubics. */
export function toPathData(curves: readonly Cubic[]): string {
  if (curves.length === 0) return "";
  let d = `M ${f(curves[0][0][0])} ${f(curves[0][0][1])}`;
  for (const [, c1, c2, p] of curves) d += ` C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p[0])} ${f(p[1])}`;
  return d;
}

export interface Polyline {
  xs: Float64Array;
  ys: Float64Array;
  /** Length along the line from its start to each point. */
  at: Float64Array;
  /** The lowest point on the page (largest y) reached up to each point: it never decreases, so it can be searched. */
  reach: Float64Array;
  total: number;
}

const bez = (a: number, b: number, c: number, d: number, t: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

/** Samples each cubic so that no chord is longer than `step` px. */
export function flatten(curves: readonly Cubic[], step = 3): Polyline {
  const xs: number[] = [];
  const ys: number[] = [];
  curves.forEach(([p0, c1, c2, p3], k) => {
    // The control net is never shorter than the curve, so sampling by it never under-samples.
    const net =
      Math.hypot(c1[0] - p0[0], c1[1] - p0[1]) + Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) + Math.hypot(p3[0] - c2[0], p3[1] - c2[1]);
    const n = Math.max(1, Math.ceil(net / step));
    // Each curve starts where the last one ended: skip that shared point.
    for (let i = k === 0 ? 0 : 1; i <= n; i++) {
      const t = i / n;
      xs.push(bez(p0[0], c1[0], c2[0], p3[0], t));
      ys.push(bez(p0[1], c1[1], c2[1], p3[1], t));
    }
  });
  const count = xs.length;
  const at = new Float64Array(count);
  const reach = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    at[i] = i === 0 ? 0 : at[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    reach[i] = i === 0 ? ys[0] : Math.max(reach[i - 1], ys[i]);
  }
  return { xs: Float64Array.from(xs), ys: Float64Array.from(ys), at, reach, total: count ? at[count - 1] : 0 };
}

/** The point `len` px along the line, and the unit direction the line heads there. */
export function pointAt(line: Polyline, len: number): { x: number; y: number; dx: number; dy: number } {
  const { xs, ys, at, total } = line;
  const count = xs.length;
  if (count === 0) return { x: 0, y: 0, dx: 0, dy: 1 };
  if (count === 1) return { x: xs[0], y: ys[0], dx: 0, dy: 1 };
  const l = Math.min(Math.max(len, 0), total);
  let lo = 0;
  let hi = count - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (at[mid] <= l) lo = mid;
    else hi = mid;
  }
  const ex = xs[hi] - xs[lo];
  const ey = ys[hi] - ys[lo];
  const span = Math.hypot(ex, ey);
  if (span === 0) return { x: xs[lo], y: ys[lo], dx: 0, dy: 1 };
  const t = Math.min(1, Math.max(0, (l - at[lo]) / (at[hi] - at[lo])));
  return { x: xs[lo] + ex * t, y: ys[lo] + ey * t, dx: ex / span, dy: ey / span };
}

/** How far the line runs before it first reaches page height `y`: 0 above its start, `total` below its end. */
export function lengthAtY(line: Polyline, y: number): number {
  const { reach, ys, at, total } = line;
  const count = reach.length;
  if (count === 0 || y <= reach[0]) return 0;
  if (y >= reach[count - 1]) return total;
  // reach[lo] < y <= reach[hi], so the segment lo→hi is where the line first gets this low.
  let lo = 0;
  let hi = count - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (reach[mid] < y) lo = mid;
    else hi = mid;
  }
  // reach rose at hi, so ys[hi] is that new lowest point and the segment crosses y on its way down.
  const t = Math.min(1, Math.max(0, (y - ys[lo]) / (ys[hi] - ys[lo])));
  return at[lo] + (at[hi] - at[lo]) * t;
}

/** Path data for little cross-stitches (x) laid every `gap` px along the line, each turned to the line's heading. */
export function crossStitches(line: Polyline, gap: number, arm: number): string {
  let d = "";
  for (let len = gap; len < line.total - 6; len += gap) {
    const { x, y, dx, dy } = pointAt(line, len);
    const tx = dx * arm;
    const ty = dy * arm;
    const nx = -ty;
    const ny = tx;
    d += `M${f(x - tx - nx)} ${f(y - ty - ny)}L${f(x + tx + nx)} ${f(y + ty + ny)}M${f(x - tx + nx)} ${f(y - ty + ny)}L${f(x + tx - nx)} ${f(y + ty - ny)}`;
  }
  return d;
}
