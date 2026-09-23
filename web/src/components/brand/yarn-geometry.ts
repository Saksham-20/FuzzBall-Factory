/**
 * Wraps of a yarn ball, as real geometry: each strand is a latitude circle of a
 * sphere around a tilted axis, projected onto the page. Three bands wound around
 * three axes cross each other the way thread does on a hand-wound ball (and on
 * the ball in the FF mark). Everything lives in a 400×400 box, ball radius 190.
 */

type V3 = readonly [number, number, number];
type P2 = readonly [number, number];

const R = 190;
const C = 200;
const f = (n: number) => Math.round(n * 10) / 10;

const unit = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};

const range = (from: number, to: number, count: number) =>
  Array.from({ length: count }, (_, i) => from + ((to - from) * i) / (count - 1));

interface Strand {
  d: string;
  /** Visible arc only: its end points on the rim, and the arc command between them. */
  a?: P2;
  b?: P2;
  arc?: string;
}

/** The front-facing part of the circle at height `h` (fraction of R) around axis `n`. */
function strand(n: V3, h: number, reverse = false): Strand | null {
  const [nx, ny, nz] = n;
  const L = Math.hypot(nx, ny);
  const r = R * Math.sqrt(Math.max(0, 1 - h * h));
  if (r < 1) return null;
  // Orthonormal basis of the circle's plane: u lies in the page, v = n × u.
  const u = [-ny / L, nx / L];
  const v = [(-nz * nx) / L, (-nz * ny) / L];
  const c = [h * R * nx, h * R * ny];
  const at = (t: number): P2 => [
    C + c[0] + r * (u[0] * Math.cos(t) + v[0] * Math.sin(t)),
    C - (c[1] + r * (u[1] * Math.cos(t) + v[1] * Math.sin(t))),
  ];
  // Screen-space axes of the projected ellipse (page y points down).
  const U = [u[0] * r, -u[1] * r];
  const V = [v[0] * r, -v[1] * r];
  const ellipse = `${f(r)} ${f(r * Math.abs(nz))} ${f((Math.atan2(U[1], U[0]) * 180) / Math.PI)}`;
  let sweep = U[0] * V[1] - U[1] * V[0] > 0 ? 1 : 0;

  // Depth along the view axis is h·R·nz + r·L·sin t; the strand shows where that is positive.
  const s0 = (-h * R * nz) / (r * L);
  if (s0 >= 1) return null;
  if (s0 <= -1) {
    const [p, q] = [at(0), at(Math.PI)];
    return { d: `M${f(p[0])} ${f(p[1])}A${ellipse} 1 ${sweep} ${f(q[0])} ${f(q[1])}A${ellipse} 1 ${sweep} ${f(p[0])} ${f(p[1])}Z` };
  }
  const t1 = Math.asin(s0);
  const large = Math.PI - 2 * t1 > Math.PI ? 1 : 0;
  let [a, b] = [at(t1), at(Math.PI - t1)];
  if (reverse) {
    [a, b] = [b, a];
    sweep = 1 - sweep;
  }
  const arc = `A${ellipse} ${large} ${sweep} ${f(b[0])} ${f(b[1])}`;
  return { d: `M${f(a[0])} ${f(a[1])}${arc}`, a, b, arc };
}

/** The visible band |p·n| ≤ w as a closed shape: two strands joined along the rim. */
function band(n: V3, w: number) {
  const top = strand(n, w);
  const bottom = strand(n, -w, true);
  if (!top?.a || !top.b || !top.arc || !bottom?.a || !bottom.b || !bottom.arc) return "";
  const angle = (p: P2) => Math.atan2(p[1] - C, p[0] - C);
  const rim = (p: P2, q: P2) => {
    let d = angle(q) - angle(p);
    while (d <= -Math.PI) d += 2 * Math.PI;
    while (d > Math.PI) d -= 2 * Math.PI;
    return `A${R} ${R} 0 0 ${d > 0 ? 1 : 0} ${f(q[0])} ${f(q[1])}`;
  };
  return `M${f(top.a[0])} ${f(top.a[1])}${top.arc}${rim(top.b, bottom.a)}${bottom.arc}${rim(bottom.b, top.a)}Z`;
}

export interface WrapLayer {
  /** Soft shadow where the band sits on the wraps below it, then its own fill. */
  shadow?: string;
  fill?: string;
  strands: string[];
  highlights: string[];
}

export interface Wraps {
  layers: WrapLayer[];
  stroke: number;
  highlight: number;
}

const AXES = {
  base: unit([1, -1, 0.5]),
  cross: unit([-0.2, 0.9, 0.38]),
  top: unit([1, 1, 0.45]),
};

function layer(n: V3, hs: number[], lift: number, w?: number): WrapLayer {
  const paths = (list: number[]) =>
    list.map((h) => strand(n, h)?.d).filter((d): d is string => Boolean(d));
  return {
    shadow: w ? band(n, w + 0.04) : undefined,
    fill: w ? band(n, w) : undefined,
    strands: paths(hs),
    highlights: paths(hs.map((h) => h + lift)),
  };
}

function build(detail: "full" | "low"): Wraps {
  if (detail === "low") {
    return {
      stroke: 13,
      highlight: 6,
      layers: [
        layer(AXES.base, range(-0.84, 0.84, 7), 0.06),
        layer(AXES.top, range(-0.26, 0.26, 3), 0.06, 0.36),
      ],
    };
  }
  return {
    stroke: 7,
    highlight: 3.5,
    layers: [
      layer(AXES.base, range(-0.93, 0.93, 13), 0.035),
      layer(AXES.cross, range(-0.155, 0.155, 3), 0.035, 0.2),
      layer(AXES.top, range(-0.335, 0.335, 6), 0.035, 0.38),
    ],
  };
}

/** Computed once per detail level; the paths never change. */
export const WRAPS = { full: build("full"), low: build("low") } as const;

/** Form shadow: the part of the ball outside a larger, offset "lit" circle (no clip needed). */
export const FORM_SHADOW = "M309.7 44.9A190 190 0 0 1 160.6 385.9A200 200 0 0 0 309.7 44.9Z";
