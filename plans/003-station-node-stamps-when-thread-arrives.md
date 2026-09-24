# 003 — Station node stamps when the thread reaches it (and stop per-frame attribute churn)

- **Status**: TODO
- **Commit**: 0444be5
- **Severity**: LOW (missed opportunity + small perf fix)
- **Category**: Missed opportunities / Performance
- **Estimated scope**: 3 files, ~30 lines

## Problem

1. **The signature moment has no feedback.** When the scroll-drawn thread reaches a station, its numbered node just swaps colour (cocoa → rose). The node was meant to "stamp" in: it carries `data-reveal="stamp"`, but `StationNode` is not a `Reveal`, so nothing ever arms it and that CSS is dead:

```tsx
// web/src/components/brand/StationNode.tsx:16 — current
      <span
        data-station-node
        data-reveal="stamp"
        className="font-stencil tabular grid size-9 place-items-center rounded-full bg-cocoa text-[13px] text-cream shadow-ticket md:size-11 md:text-[15px]"
      >
```

```css
/* web/src/app/globals.css:423 — current */
[data-station-node] {
  transition:
    background-color 300ms var(--ease-out),
    transform 300ms var(--ease-out);
}
```

2. **Attribute churn on every scroll frame.** `render()` rewrites `data-live` on every node on every frame, even when nothing changed, which invalidates style for attribute selectors each frame:

```ts
// web/src/components/home/ConveyorThread.tsx:205 — current
      // The node the thread has just reached goes live (rose): the one live thing.
      const readY = pt.y;
      let live: Element | null = null;
      for (const n of nodeYs) if (n.y <= readY + 8) live = n.el;
      for (const n of nodeYs) {
        if (n.el === live) n.el.setAttribute("data-live", "");
        else n.el.removeAttribute("data-live");
      }
```

## Target

- `data-live` is written only when the live node changes.
- When a node newly goes live **while scrolling forward**, it gives one stamp press via the Web Animations API: scale `1.18` → `1`, 280ms, `cubic-bezier(0.23, 1, 0.32, 1)`. Scrolling back up just recolours (no stamp). Under `prefers-reduced-motion` there is no scale, only the colour change.
- No stamp fires until the reader's own first scroll input (wheel, touch, key or pointer). Several things re-run `render()` on load after the effect has started, and each can move the live node: the ResizeObserver's first callback, the `document.fonts.ready` rebuild after a font swap shifts the layout, and the browser restoring the scroll position on a mid-page reload. Gating on `started` is not enough.
- The dead `data-reveal="stamp"` attribute is gone, and the node's CSS transition covers only `background-color`.

```ts
// web/src/components/home/ConveyorThread.tsx — target (inside the effect)
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
    // ...
      // The node the thread has just reached goes live (rose): the one live thing.
      const readY = pt.y;
      let index = -1;
      nodeYs.forEach((n, i) => {
        if (n.y <= readY + 8) index = i;
      });
      const next = index >= 0 ? nodeYs[index].el : null;
      if (next !== liveEl) {
        liveEl?.removeAttribute("data-live");
        next?.setAttribute("data-live", "");
        // Moving forward onto a station: the node takes a stamp, as the thread is stitched through it.
        if (next && index > liveIndex && !reduced && canStamp) {
          next.animate([{ transform: "scale(1.18)" }, { transform: "scale(1)" }], {
            duration: 280,
            easing: "cubic-bezier(0.23, 1, 0.32, 1)",
          });
        }
        liveEl = next;
        liveIndex = index;
      }
    // ...
    // next to the existing `window.addEventListener("resize", schedule);`
    for (const type of INPUTS) window.addEventListener(type, allowStamps, { passive: true });
    // ...
    // inside the existing cleanup `return () => { ... }`, after `window.removeEventListener("resize", schedule);`
      for (const type of INPUTS) window.removeEventListener(type, allowStamps);
```

```css
/* web/src/app/globals.css — target */
[data-station-node] {
  transition: background-color 300ms var(--ease-out);
}
```

## Repo conventions to follow

- `ConveyorThread.tsx` keeps all state as `let` variables inside its single `useEffect` (see `total`, `introV`, `nodeYs`, `hookBox` near line 51). Add the new state next to them.
- The effect already computes `const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;` (line 49). Reuse it. Leave `let started = false;` (line 59) and its uses alone; the stamp gate is `canStamp`, not `started`.
- Listeners are added near the end of the effect (`window.addEventListener("scroll", schedule, { passive: true });`, `window.addEventListener("resize", schedule);`) and removed in the effect's cleanup (`return () => { ro.disconnect(); ... }`). Follow the same pattern.
- Curve: `--ease-out` is `cubic-bezier(0.23, 1, 0.32, 1)` (`globals.css` `@theme`); WAAPI needs the literal value.

## Steps

Line numbers are hints; each step's quoted code is the anchor.

1. `web/src/components/brand/StationNode.tsx`: delete the line `data-reveal="stamp"` (currently line 18). Nothing else changes.
2. `web/src/app/globals.css`, in the `[data-station-node] { ... }` rule quoted in **Problem 1** (currently line 423): make it `transition: background-color 300ms var(--ease-out);` (drop the `transform` part).
3. `web/src/components/home/ConveyorThread.tsx`: add `liveEl`, `liveIndex`, `canStamp`, `INPUTS` and `allowStamps` from **Target** beside the other `let` state (after `let started = false;`).
4. Same file: replace the block quoted in **Problem 2** (from the comment line through the closing `}` of the second `for`) with the render block in **Target**.
5. Same file: add the `INPUTS` listener loop right after `window.addEventListener("resize", schedule);`, and the matching removal loop inside the cleanup, after `window.removeEventListener("resize", schedule);`.
6. Do not reset `liveEl`/`liveIndex` anywhere else. `build()` reuses the same node elements on resize. Every render before the reader's first input marks the live node without a stamp, because `canStamp` is still false.

## Boundaries

- Do NOT change the thread path, the hook, the intro, or scroll handling.
- Do NOT stamp on scroll-up, before the reader's first scroll input, or under reduced motion.
- Do NOT add dependencies. If the quoted code has drifted (not just its line number), STOP and report.

## Verification

- **Mechanical**: `cd web && npx tsc --noEmit -p . && npm run lint` exit 0.
- **Perf**: DevTools > Performance, record a 5s scroll through the stations: `data-live` mutations appear only when the thread passes a node, not every frame (DevTools > Elements shows the attribute flash only at those moments).
- **Feel check** on `/` (desktop):
  - Scroll down slowly: as the thread reaches 01, 02, 03… each node turns rose and gives one short press (grows ~18%, settles in under 0.3s). It feels like a stamp, not a bounce.
  - Scroll back up: nodes recolour but do not stamp.
  - Reload mid-page, once normally and once with DevTools > Network "Slow 3G" (fonts land late and shift the layout): no stamp fires until you scroll.
  - From the top, scroll with the keyboard (Space / Page Down): nodes stamp as the thread reaches them.
  - DevTools > Animations at 10%: the scale starts big and eases out; no overshoot below 1.
  - Reduced motion (Rendering panel): colour change only.
- **Done when**: all checks above hold.
