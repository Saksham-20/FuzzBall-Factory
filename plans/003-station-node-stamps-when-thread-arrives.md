# 003 — Station node stamps when the thread reaches it (and stop per-frame attribute churn)

- **Status**: TODO
- **Commit**: 3241ba4
- **Severity**: LOW (missed opportunity + small perf fix)
- **Category**: Missed opportunities / Performance
- **Estimated scope**: 3 files, ~20 lines

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
/* web/src/app/globals.css:386 — current */
[data-station-node] {
  transition:
    background-color 300ms var(--ease-out),
    transform 300ms var(--ease-out);
}
```

2. **Attribute churn on every scroll frame.** `render()` rewrites `data-live` on every node on every frame, even when nothing changed, which invalidates style for attribute selectors each frame:

```ts
// web/src/components/home/ConveyorThread.tsx:201 — current
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
- The dead `data-reveal="stamp"` attribute is gone, and the node's CSS transition covers only `background-color`.

```ts
// web/src/components/home/ConveyorThread.tsx — target (inside the effect)
    let liveEl: Element | null = null;
    let liveIndex = -1;
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
        if (next && index > liveIndex && !reduced && started) {
          next.animate([{ transform: "scale(1.18)" }, { transform: "scale(1)" }], {
            duration: 280,
            easing: "cubic-bezier(0.23, 1, 0.32, 1)",
          });
        }
        liveEl = next;
        liveIndex = index;
      }
```

```css
/* web/src/app/globals.css — target */
[data-station-node] {
  transition: background-color 300ms var(--ease-out);
}
```

## Repo conventions to follow

- `ConveyorThread.tsx` keeps all state as `let` variables inside its single `useEffect` (see `total`, `introV`, `nodeYs`, `hookBox` near line 51). Add `liveEl` and `liveIndex` next to them.
- The effect already computes `const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;` (line 49) and `let started = false;` (line 59). Reuse both.
- Curve: `--ease-out` is `cubic-bezier(0.23, 1, 0.32, 1)` (`globals.css` `@theme`); WAAPI needs the literal value.

## Steps

1. `web/src/components/brand/StationNode.tsx`: delete the line `data-reveal="stamp"` (line 18). Nothing else changes.
2. `web/src/app/globals.css` (block at line 386): make the `[data-station-node]` rule `transition: background-color 300ms var(--ease-out);` (drop the `transform` part).
3. `web/src/components/home/ConveyorThread.tsx`: add `let liveEl: Element | null = null;` and `let liveIndex = -1;` beside the other `let` state (after `let started = false;`).
4. Same file: replace the block quoted in **Problem 2** (from the comment line through the closing `}` of the second `for`) with the block in **Target**.
5. Do not reset `liveEl`/`liveIndex` anywhere else. `build()` reuses the same node elements on resize, and its first call runs `render()` before `started = true`, so the node that is live on load is marked without a stamp.

## Boundaries

- Do NOT change the thread path, the hook, the intro, or scroll handling.
- Do NOT stamp on scroll-up, on the first render after load, or under reduced motion.
- Do NOT add dependencies. If the quoted code has drifted, STOP and report.

## Verification

- **Mechanical**: `cd web && npx tsc --noEmit -p . && npm run lint` exit 0.
- **Perf**: DevTools > Performance, record a 5s scroll through the stations: `data-live` mutations appear only when the thread passes a node, not every frame (DevTools > Elements shows the attribute flash only at those moments).
- **Feel check** on `/` (desktop):
  - Scroll down slowly: as the thread reaches 01, 02, 03… each node turns rose and gives one short press (grows ~18%, settles in under 0.3s). It feels like a stamp, not a bounce.
  - Scroll back up: nodes recolour but do not stamp.
  - Reload mid-page: no stamp fires on load.
  - DevTools > Animations at 10%: the scale starts big and eases out; no overshoot below 1.
  - Reduced motion (Rendering panel): colour change only.
- **Done when**: all checks above hold.
