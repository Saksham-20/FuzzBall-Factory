"use client";

import { useEffect, useRef } from "react";
import { CrochetHook } from "@/components/brand/CrochetHook";
import { catmullRom, crossStitches, flatten, lengthAtY, pointAt, toPathData, type Cubic, type Polyline, type Pt } from "./thread-geometry";

const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);
/** Degrees the hero ball turns per pixel of thread paid out: about a quarter turn across the first screen. */
const UNWIND = 0.14;

/**
 * The conveyor: one rose yarn thread that leaves the hero ball, drops into the
 * gutter and runs through every station node. Drawn as you scroll; a crochet
 * hook rides its tip. Place inside a `position: relative` wrapper that holds
 * `[data-hero]`, `[data-thread-start]` and the `[data-station-node]`s, and
 * optionally a `[data-thread-end]` below the last node, where the loose end
 * parks. Decorative only: content never depends on it.
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
    // The hero ball's wraps turn as the thread pays out (on the compositor: will-change keeps it off repaint).
    const wraps = reduced ? null : wrap.querySelector<SVGSVGElement>(".hero-ball [data-wraps]");
    if (wraps) {
      wraps.style.transformOrigin = "50% 50%";
      wraps.style.willChange = "transform";
    }

    let route: Polyline | null = null;
    let total = 0;
    let introLen = 0;
    let introV = 0;
    let wrapTop = 0;
    let nodeYs: { el: Element; y: number }[] = [];
    let hookBox = { w: 22, h: 176, ox: 14.8, oy: 12.2, rot: 172 };
    let raf = 0;
    let started = false;
    let disposed = false;
    // What the last route was built from: an unchanged layout skips the rebuild.
    let builtFor = "";

    // The node the thread has reached (the one live thing); the attribute is only written when it changes.
    let liveEl: Element | null = null;
    let liveIndex = -1;
    // Stamps wait for the reader's own first scroll input: layout settling on load (the ResizeObserver's
    // first callback, the font-ready rebuild, scroll restoration) can move the live node too.
    let canStamp = false;
    const INPUTS = ["wheel", "touchmove", "keydown", "pointerdown"] as const;
    const allowStamps = () => {
      canStamp = true;
      for (const type of INPUTS) window.removeEventListener(type, allowStamps);
    };

    function build() {
      const wb = wrap!.getBoundingClientRect();
      const rel = (r: DOMRect): Pt => [r.left + r.width / 2 - wb.left, r.top + r.height / 2 - wb.top];
      const start = wrap!.querySelector("[data-thread-start]");
      const nodes = Array.from(wrap!.querySelectorAll("[data-station-node]"));
      const hero = wrap!.querySelector("[data-hero]");
      const end = wrap!.querySelector("[data-thread-end]");
      if (!start || nodes.length === 0 || !hero) return;

      // Tailwind's md/lg queries, not the wrapper width: that leaves out a classic scrollbar and
      // ignores the reader's font size, so the route could disagree with the layout.
      const small = !window.matchMedia("(min-width: 48rem)").matches;
      // Below lg the hero stacks (ball above the copy), so the thread has to cross above the headline.
      const stacked = !window.matchMedia("(min-width: 64rem)").matches;
      const S = rel(start.getBoundingClientRect());
      const N = nodes.map((n) => rel(n.getBoundingClientRect()));
      const heroBottom = hero.getBoundingClientRect().bottom - wb.top;
      // The hanging ticket: the thread runs through its punched hole, then along its top edge and off its left side.
      const holeEl = wrap!.querySelector("[data-thread-hole]");
      const tagBox = holeEl?.closest("[data-thread-tag]")?.getBoundingClientRect();
      const H = holeEl ? rel(holeEl.getBoundingClientRect()) : null;
      // Side by side, the sweep to the gutter runs under the hero copy's last line, never through it.
      const copyBottom = (hero.querySelector("[data-hero-copy]")?.getBoundingClientRect().bottom ?? 0) - wb.top;
      // Where the loose end parks: the middle of the buy ticket's left edge. The hook leans up from there, inside
      // the ticket's own padding on a phone; level with its buttons on a wider screen.
      const er = end?.getBoundingClientRect();
      const E: Pt | null = er ? [er.left - wb.left, er.top + er.height / 2 - wb.top] : null;

      const key = [wb.width, wb.height, small, stacked, heroBottom, ...S, ...N.flat(), ...(E ?? []), ...(H ?? []), tagBox?.left ?? 0, copyBottom].map((n) => (typeof n === "number" ? Math.round(n) : n)).join();
      wrapTop = wb.top + window.scrollY;
      if (key === builtFor) return render();
      builtFor = key;
      const gx = N[0][0];
      const amp = small ? 5 : 12;

      // Ball → hanging ticket: tail, hole, then off the ticket's left side (O), where the crossing to the gutter starts.
      const lead: Pt[] = H && tagBox ? [S, H, [tagBox.left - wb.left - 6, H[1] + 3]] : [S];
      const O = lead[lead.length - 1];
      const run = O[0] - gx;

      // Ball → gutter. Side by side: leaves toward the lower left and sweeps under the copy.
      // Stacked: crosses to the gutter above the headline, then drops beside the copy.
      const pts: Pt[] = [...lead];
      // Evenly spaced points down a long gutter drop: one short step followed by a long one makes the spline's
      // tangent overshoot, and the thread would climb back before it falls.
      const fill = (y0: number, y1: number) => {
        const n = Math.max(0, Math.floor((y1 - y0) / 140));
        for (let j = 1; j <= n; j++) pts.push([gx + amp * (j % 2 ? 0.8 : 0.3), y0 + ((y1 - y0) * j) / (n + 1)]);
      };
      if (stacked && run > 140) {
        // Evenly spaced points along a long crossing (tablet) keep the spline's tangents short,
        // so it turns into the gutter cleanly instead of overshooting and kinking.
        const x0 = O[0] - 50;
        // Never right of x0: on the narrowest screens the corner would otherwise sit behind the
        // crossing's start, and the line would double back on itself.
        const x1 = Math.min(gx + 60, x0 - 12);
        const steps = Math.max(0, Math.floor((x0 - x1) / 120));
        const crossing: Pt[] = Array.from({ length: steps }, (_, j) => {
          const t = (j + 1) / (steps + 1);
          return [x0 + (x1 - x0) * t, O[1] + 26 + 5 * t + 3 * Math.sin(Math.PI * t)];
        });
        pts.push(
          [x0, O[1] + 26],
          ...crossing,
          // a rounded corner into the gutter
          [x1, O[1] + 31],
          [gx + 26, O[1] + 38],
          [gx + amp + 2, O[1] + 62],
          [gx + amp, O[1] + 96],
        );
        fill(O[1] + 96, heroBottom - 100);
        pts.push([gx + amp * 0.5, heroBottom - 100], [gx + amp * 0.6, heroBottom - 44]);
      } else if (stacked) {
        // A phone: the ticket hangs close to the gutter, so the thread just bends down into it, clear of the
        // ticket's left edge, and drops beside the copy.
        pts.push([gx + run * 0.45, O[1] + 16], [gx + amp + 2, O[1] + 46], [gx + amp, O[1] + 90]);
        fill(O[1] + 90, heroBottom - 100);
        pts.push([gx + amp * 0.5, heroBottom - 100], [gx + amp * 0.6, heroBottom - 44]);
      } else if (H) {
        // Side by side, from the hanging ticket: the thread rounds the ticket's top corner, falls beside it, then
        // sweeps left under the copy's last line into the gutter. Every point is lower than the last; the corner
        // keeps the tangent at O level and a midpoint halves the fall, so the thread never rises as it rounds the
        // ticket's corner.
        const under = copyBottom + 34;
        const corner: Pt = [O[0] - 11, O[1] + 26];
        const fall: Pt = [O[0] - 14, Math.max(O[1] + 90, under - 20)];
        const mid: Pt = [O[0] - 14, (corner[1] + fall[1]) / 2];
        const sweep: Pt = [gx + run * 0.55, Math.max(fall[1] + 30, under)];
        // It lands in the gutter just below the sweep; on a tall screen the rest of the drop is evenly spaced.
        const land: Pt = [gx + run * 0.05, Math.max(Math.min(heroBottom - 100, sweep[1] + 90), sweep[1] + 20)];
        pts.push(corner, mid, fall, sweep, land);
        if (heroBottom - 100 > land[1] + 60) {
          fill(land[1], heroBottom - 100);
          pts.push([gx + amp * 0.5, heroBottom - 100]);
        }
        pts.push([gx + amp * 0.6, Math.max(heroBottom - 44, pts[pts.length - 1][1] + 40)]);
      } else {
        const D = Math.max(120, heroBottom - 100 - O[1]);
        pts.push(
          [O[0] - Math.min(70, run * 0.12), O[1] + D * 0.12],
          [gx + run * 0.62, O[1] + D * 0.72],
          [gx + run * 0.05, heroBottom - 100],
          [gx + amp * 0.6, heroBottom - 44],
        );
      }
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
      const last = N[N.length - 1];
      let curves: Cubic[];
      if (E && E[1] > last[1] + 120) {
        // The loose end parks on the last way in: on down the gutter to the buy ticket, then out into its edge,
        // where the hook rests. The turn never climbs, and it stays left of the ticket until it meets it.
        const turnY = E[1] - 36;
        const span = turnY - last[1];
        const waves = Math.max(1, Math.round(span / 240));
        for (let w = 1; w <= waves; w++) {
          const t = w / (waves + 1);
          pts.push([gx + ((N.length + w) % 2 ? 1 : -1) * amp, last[1] + span * t]);
        }
        pts.push([gx, turnY]);
        pts.push([Math.min(gx + 18, E[0] - 10), E[1] - 6]);
        pts.push([E[0] + 4, E[1]]);
        curves = catmullRom(pts);
      } else {
        // No buy ticket below the stations: a longer tail below the last node, so the hook parked on the loose end
        // clears the node too, and a small curl that turns back into the gutter, off the copy and labels.
        pts.push([gx + 2, last[1] + 95]);
        pts.push([gx - 2, last[1] + 200]);
        const e = pts[pts.length - 1];
        const k = small ? 0.55 : 1;
        const c = (dx: number, dy: number): Pt => [e[0] - dx * k, e[1] + dy * k];
        const curl: Cubic[] = [
          [e, c(2, 34), c(46, 34), c(46, 8)],
          [c(46, 8), c(46, -14), c(14, -16), c(12, 4)],
        ];
        curves = [...catmullRom(pts), ...curl];
      }
      const d = toPathData(curves);
      route = flatten(curves);
      total = route.total;

      s!.setAttribute("viewBox", `0 0 ${wb.width} ${wb.height}`);
      s!.setAttribute("width", String(wb.width));
      s!.setAttribute("height", String(wb.height));
      for (const p of [h!, l!]) {
        p.setAttribute("d", d);
        // Dash lengths in our own units: the browser scales them to its measure of the path, so it never has to be asked.
        p.setAttribute("pathLength", String(total));
        p.style.strokeDasharray = `${total}`;
      }
      const sw = small ? 3.5 : 4.5;
      l!.setAttribute("stroke-width", String(sw));
      h!.setAttribute("stroke-width", String(sw + 5));

      // The stitches still to come: little cross-stitches (x) laid along the route, each turned to the
      // thread's heading. They are small enough that the drawn thread and its halo cover them completely.
      g!.setAttribute("d", crossStitches(route, small ? 20 : 26, small ? 2.4 : 2.9));

      introLen = lengthAtY(route, heroBottom - 100);
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
      if (!route || !total) return;
      let tip: number;
      if (reduced) {
        tip = total;
      } else {
        const readY = window.scrollY + window.innerHeight * 0.62 - wrapTop;
        tip = Math.max(introV, readY > 0 ? lengthAtY(route, readY) : 0);
      }
      const off = total - tip;
      for (const p of [halo.current!, line.current!]) {
        p.style.strokeDashoffset = `${off}`;
        p.style.opacity = tip < 2 ? "0" : "1";
      }
      const pt = pointAt(route, tip);
      if (wraps) wraps.style.transform = `rotate(${(-tip * UNWIND).toFixed(1)}deg)`;
      const bob = reduced ? 0 : Math.sin(tip / 38) * 5;
      hk!.style.transform = `translate3d(${pt.x - hookBox.ox}px, ${pt.y - hookBox.oy}px, 0) rotate(${hookBox.rot + bob}deg)`;
      if (started) hk!.style.opacity = "1";

      // The node the thread has just reached goes live (rose): the one live thing.
      let index = -1;
      nodeYs.forEach((n, i) => {
        if (n.y <= pt.y + 8) index = i;
      });
      const live = index >= 0 ? nodeYs[index].el : null;
      if (live !== liveEl) {
        liveEl?.removeAttribute("data-live");
        live?.setAttribute("data-live", "");
        // Moving forward onto a station: the node takes a stamp, as the thread is stitched through it.
        if (live && index > liveIndex && !reduced && canStamp) {
          live.animate([{ transform: "scale(1.18)" }, { transform: "scale(1)" }], {
            duration: 280,
            easing: "cubic-bezier(0.23, 1, 0.32, 1)",
          });
        }
        liveEl = live;
        liveIndex = index;
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

    const rebuild = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        build();
      });
    };
    const ro = new ResizeObserver(rebuild);
    ro.observe(wrap);
    // The thread starts at the ball's tail, and the ball scales in: measure again once it has settled.
    const ball = wrap.querySelector(".hero-ball");
    ball?.addEventListener("animationend", rebuild);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    for (const type of INPUTS) window.addEventListener(type, allowStamps, { passive: true });
    document.fonts?.ready.then(() => {
      if (!disposed) build();
    });
    return () => {
      disposed = true;
      ro.disconnect();
      ball?.removeEventListener("animationend", rebuild);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(introRaf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      for (const type of INPUTS) window.removeEventListener(type, allowStamps);
    };
  }, []);

  return (
    <div ref={box} aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <svg ref={svg} className="absolute top-0 left-0" fill="none">
        {/* stitches still to come: cross-stitches along the route */}
        <path ref={ghost} stroke="#a8804f" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
        {/* paper halo keeps the thread legible on kraft and cream alike */}
        <path ref={halo} stroke="#fcf8f2" strokeOpacity="0.9" strokeLinecap="round" strokeLinejoin="round" />
        <path ref={line} data-thread-line stroke="#c98586" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div ref={hook} className="absolute top-0 left-0 opacity-0 will-change-transform">
        <CrochetHook className="size-full drop-shadow-[0_3px_3px_rgb(63_38_25/0.25)]" />
      </div>
    </div>
  );
}
