# 005 — Header: stop animating `backdrop-filter`

- **Status**: TODO
- **Commit**: 7cc98fe
- **Severity**: LOW
- **Category**: Performance
- **Estimated scope**: 1 file, 1 line

## Problem

When the page scrolls past 8px, the sticky header switches to a translucent cream with a blur, and it animates the blur radius itself:

```tsx
// web/src/components/store/Header.tsx:34 — current
      className={cn(
        "sticky top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-200 ease-out",
        isScrolled ? "bg-cream/92 shadow-[0_1px_0_var(--color-line)] backdrop-blur-md" : "bg-cream",
      )}
```

Interpolating `backdrop-filter` re-blurs everything behind a full-width bar on every frame of the transition. On mid-range Android that is a visible hitch right as the reader starts scrolling, the moment they are watching most. The blur's arrival does not need animating: at 92% cream opacity the bar changes almost imperceptibly, and the background colour and hairline shadow already carry the change.

## Target

```tsx
// web/src/components/store/Header.tsx — target
        "sticky top-0 z-40 transition-[background-color,box-shadow] duration-200 ease-out",
```

The blur applies instantly; the background colour and the 1px shadow still ease over 200ms.

## Repo conventions to follow

- Hover-only and device-specific styles use the `hf:` variant or `[@media(hover:hover)_and_(pointer:fine)]:`; not relevant here, leave them.
- Keep Tailwind arbitrary transition lists in the `transition-[a,b]` form already used in this file.

## Steps

1. `web/src/components/store/Header.tsx:35`: remove `,backdrop-filter` from the `transition-[...]` list so it reads `transition-[background-color,box-shadow]`.

## Boundaries

- Do NOT change `backdrop-blur-md`, the colours, the 8px threshold or the `useSyncExternalStore` logic.
- If the line has drifted, STOP and report.

## Verification

- **Mechanical**: `cd web && npx tsc --noEmit -p . && npm run lint` exit 0.
- **Feel check**: on `/`, scroll down from the very top on a phone (or DevTools with 4× CPU throttle): the header's background and hairline ease in without a hitch; content under the header is blurred once scrolled; scrolling back to the top returns to solid cream.
- **Done when**: the transition list no longer includes `backdrop-filter` and the feel check holds.
