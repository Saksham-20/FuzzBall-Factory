"use client";

import { useEffect, useRef } from "react";
import { CrochetHook } from "@/components/brand/CrochetHook";

type Pt = [number, number];

/** Uniform Catmull-Rom through points, as cubic Béziers. */
function smoothPath(pts: Pt[]) {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

/**
 * The conveyor: one rose yarn thread that leaves the hero ball, drops into the
 * gutter and runs through every station node. Drawn as you scroll; a crochet
 * hook rides its tip. Place inside a `position: relative` wrapper that holds
 * `[data-hero]`, `[data-thread-start]` and the `[data-station-node]`s.
 * Decorative only: content never depends on it.
 */
export function ConveyorThread() {
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const ghost = useRef<SVGPathElement>(null);
  const halo = useRef<SVGPathElement>(null);
  const line = useRef<SVGPathElement>(null);
  const hook = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = box.current?.parentElement;
    const s = svg.current;
    const g = ghost.current;
    const h = halo.current;
    const l = line.current;
    const hk = hook.current;
    if (!wrap || !s || !g || !h || !l || !hk) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let total = 0;
    let introLen = 0;
    let introV = 0;
    let wrapTop = 0;
    let ys: number[] = []; // running-max y per 4px of length: monotone, so binary-searchable
    let nodeYs: { el: Element; y: number }[] = [];
    let hookBox = { w: 22, h: 176, ox: 14.8, oy: 12.2, rot: 172 };
    let raf = 0;
    let started = false;

    const STEP = 4;
    const lenForY = (y: number) => {
      let lo = 0;
      let hi = ys.length - 1;
      if (y <= ys[0]) return 0;
      if (y >= ys[hi]) return total;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (ys[mid] < y) lo = mid + 1;
        else hi = mid;
      }
      return Math.min(total, lo * STEP);
    };

    function build() {
      const wb = wrap!.getBoundingClientRect();
      const rel = (r: DOMRect): Pt => [r.left + r.width / 2 - wb.left, r.top + r.height / 2 - wb.top];
      const start = wrap!.querySelector("[data-thread-start]");
      const nodes = Array.from(wrap!.querySelectorAll("[data-station-node]"));
      const hero = wrap!.querySelector("[data-hero]");
      if (!start || nodes.length === 0 || !hero) return;

      const small = wb.width < 768;
      // Below lg the hero stacks (ball above the copy), so the thread has to cross above the headline.
      const stacked = wb.width < 1024;
      const S = rel(start.getBoundingClientRect());
      const N = nodes.map((n) => rel(n.getBoundingClientRect()));
      const gx = N[0][0];
      const heroBottom = hero.getBoundingClientRect().bottom - wb.top;
      const D = Math.max(120, heroBottom - 100 - S[1]);
      const amp = small ? 5 : 12;

      // Evenly spaced points along a long crossing (tablet) keep the spline's tangents short,
      // so it turns into the gutter cleanly instead of overshooting and kinking.
      const x0 = S[0] - 50;
      const x1 = gx + 60;
      const steps = Math.max(0, Math.floor((x0 - x1) / 120));
      const crossing: Pt[] = Array.from({ length: steps }, (_, j) => {
        const t = (j + 1) / (steps + 1);
        return [x0 + (x1 - x0) * t, S[1] + 26 + 5 * t + 3 * Math.sin(Math.PI * t)];
      });

      // Ball → gutter. Side by side: leaves toward the lower left and sweeps under the copy.
      // Stacked: crosses to the gutter above the headline, then drops beside the copy.
      const pts: Pt[] = stacked
        ? [
            S,
            [x0, S[1] + 26],
            ...crossing,
            // a rounded corner into the gutter
            [x1, S[1] + 31],
            [gx + 26, S[1] + 38],
            [gx + amp + 2, S[1] + 62],
            [gx + amp, S[1] + 96],
            [gx + amp * 0.5, heroBottom - 100],
            [gx + amp * 0.6, heroBottom - 44],
          ]
        : [
            S,
            [S[0] - Math.min(70, (S[0] - gx) * 0.12), S[1] + D * 0.12],
            [gx + (S[0] - gx) * 0.62, S[1] + D * 0.72],
            [gx + (S[0] - gx) * 0.05, heroBottom - 100],
            [gx + amp * 0.6, heroBottom - 44],
          ];
      // Gutter run: through every node, with a gentle handmade wobble between them.
      let prev: Pt = pts[pts.length - 1];
      N.forEach((n, i) => {
        const span = n[1] - prev[1];
        const waves = Math.max(1, Math.round(span / 240));
        for (let w = 1; w <= waves; w++) {
          const t = w / (waves + 1);
          const sign = (i + w) % 2 ? 1 : -1;
          pts.push([gx + sign * amp, prev[1] + span * t]);
        }
        pts.push(n);
        prev = n;
      });
      // A longer tail below the last node, so the hook parked on the loose end clears the node too.
      const last = N[N.length - 1];
      pts.push([gx + 2, last[1] + 95]);
      pts.push([gx - 2, last[1] + 200]);

      // The thread ends loose: a small curl, waiting for you to pick it up. It turns back into
      // the gutter, so neither the curl nor the hook parked on its tip lands on the copy or labels.
      const e = pts[pts.length - 1];
      const k = small ? 0.55 : 1;
      const cx = (dx: number) => e[0] - dx * k;
      const cy = (dy: number) => e[1] + dy * k;
      const curl = ` C ${cx(2)} ${cy(34)} ${cx(46)} ${cy(34)} ${cx(46)} ${cy(8)} C ${cx(46)} ${cy(-14)} ${cx(14)} ${cy(-16)} ${cx(12)} ${cy(4)}`;
      const d = smoothPath(pts) + curl;

      s!.setAttribute("viewBox", `0 0 ${wb.width} ${wb.height}`);
      s!.setAttribute("width", String(wb.width));
      s!.setAttribute("height", String(wb.height));
      for (const p of [g!, h!, l!]) p.setAttribute("d", d);
      const sw = small ? 3.5 : 4.5;
      l!.setAttribute("stroke-width", String(sw));
      h!.setAttribute("stroke-width", String(sw + 5));

      total = l!.getTotalLength();
      for (const p of [h!, l!]) p.style.strokeDasharray = `${total}`;

      ys = [];
      let run = -Infinity;
      for (let len = 0; len <= total; len += STEP) {
        run = Math.max(run, l!.getPointAtLength(len).y);
        ys.push(run);
      }

      wrapTop = wb.top + window.scrollY;
      introLen = lenForY(heroBottom - 100);
      nodeYs = nodes.map((el, i) => ({ el, y: N[i][1] }));
      hookBox = small
        ? { w: 16, h: 128, ox: 10.8, oy: 8.8, rot: 172 }
        : { w: 22, h: 176, ox: 14.8, oy: 12.2, rot: 172 };
      hk!.style.width = `${hookBox.w}px`;
      hk!.style.height = `${hookBox.h}px`;
      hk!.style.transformOrigin = `${hookBox.ox}px ${hookBox.oy}px`;
      render();
    }

    function render() {
      if (!total) return;
      let tip: number;
      if (reduced) {
        tip = total;
      } else {
        const readY = window.scrollY + window.innerHeight * 0.62 - wrapTop;
        tip = Math.max(introV, readY > 0 ? lenForY(readY) : 0);
      }
      const off = total - tip;
      for (const p of [halo.current!, line.current!]) {
        p.style.strokeDashoffset = `${off}`;
        p.style.opacity = tip < 2 ? "0" : "1";
      }
      const pt = line.current!.getPointAtLength(Math.min(tip, total));
      const bob = reduced ? 0 : Math.sin(tip / 38) * 5;
      hk!.style.transform = `translate3d(${pt.x - hookBox.ox}px, ${pt.y - hookBox.oy}px, 0) rotate(${hookBox.rot + bob}deg)`;
      if (started) hk!.style.opacity = "1";

      // The node the thread has just reached goes live (rose): the one live thing.
      const readY = pt.y;
      let live: Element | null = null;
      for (const n of nodeYs) if (n.y <= readY + 8) live = n.el;
      for (const n of nodeYs) {
        if (n.el === live) n.el.setAttribute("data-live", "");
        else n.el.removeAttribute("data-live");
      }
    }

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        render();
      });
    };

    build();
    started = true;
    render();

    // Intro: thread pays out of the ball once, then scroll takes over.
    let introRaf = 0;
    if (!reduced) {
      const t0 = performance.now() + 380;
      const tick = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - t0) / 1200));
        introV = introLen * easeOut(t);
        render();
        if (t < 1) introRaf = requestAnimationFrame(tick);
      };
      introRaf = requestAnimationFrame(tick);
    }

    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        build();
      });
    });
    ro.observe(wrap);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.fonts?.ready.then(() => build());
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      cancelAnimationFrame(introRaf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div ref={box} aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <svg ref={svg} className="absolute top-0 left-0" fill="none">
        {/* stitches still to come */}
        <path ref={ghost} stroke="#a8804f" strokeOpacity="0.5" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 11" />
        {/* paper halo keeps the thread legible on kraft and cream alike */}
        <path ref={halo} stroke="#fcf8f2" strokeOpacity="0.9" strokeLinecap="round" strokeLinejoin="round" />
        <path ref={line} stroke="#c98586" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div ref={hook} className="absolute top-0 left-0 opacity-0 will-change-transform">
        <CrochetHook className="size-full drop-shadow-[0_3px_3px_rgb(63_38_25/0.25)]" />
      </div>
    </div>
  );
}
