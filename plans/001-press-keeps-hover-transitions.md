# 001 — Stop `.press` from swallowing every hover transition

- **Status**: TODO
- **Commit**: 364770d
- **Severity**: MEDIUM (site-wide, one-line fix, highest leverage)
- **Category**: Easing & duration (declared transitions never run)
- **Estimated scope**: 1 file, 3 lines

## Problem

`.press` is the shared press-feedback utility (scale on `:active`). It is declared with the `transition` **shorthand**, and it sits later in the utilities layer than Tailwind's generated classes, so it wins the cascade and resets `transition-property` to `transform` only:

```css
/* web/src/app/globals.css:161 — current */
  .press {
    transition: transform 160ms var(--ease-out);
  }
  .press:active {
    transform: scale(0.97);
  }
```

17 components pair `press` with their own colour/shadow transitions, and every one of those is silently discarded. Measured in the browser on the hero "Shop the shelf" button: `getComputedStyle(el).transitionProperty === "transform"`. Result: every button, icon button and tab snaps its hover background, text colour and shadow instantly instead of easing. Examples of the discarded declarations:

```ts
// web/src/components/ui/Button.tsx:7 — declared, never applied
"press inline-flex ... transition-[background-color,box-shadow,color] duration-150 ease-out ..."
// web/src/components/store/Header.tsx:25
"press relative grid size-11 ... transition-colors duration-150 ..."
// web/src/components/store/WhatsAppButton.tsx:46
"press grid size-14 ... transition-colors duration-150 ..."
// web/src/components/account/custom/WorkOrderList.tsx:86
className="press transition-[transform,box-shadow] duration-150 ease-out ..."
```

(Also: `components/ui/Tabs.tsx:16`, `shop/ShopClient.tsx:233`, `shop/FilterPanel.tsx:18`, `ui/ImageUploader.tsx:72`, `admin/AdminShell.tsx:47`, `admin/settings/SettingsClient.tsx:89`, `admin/products/ProductEditor.tsx:155`, `admin/orders/ReasonModal.tsx:95`, `admin/custom/CustomClient.tsx:35`, `admin/catalogue/kit.tsx:51`, `account/AccountShell.tsx:85`, `custom/CustomForm.tsx:45`.)

## Target

`.press` keeps owning the transition (it has to, or the `:active` scale would lose its easing wherever a component only declared `transition-colors`), but it now covers every property those components meant to animate:

```css
/* web/src/app/globals.css — target */
  .press {
    transition-property: transform, color, background-color, border-color, box-shadow;
    transition-duration: 160ms;
    transition-timing-function: var(--ease-out);
  }
  .press:active {
    transform: scale(0.97);
  }
```

160ms with `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` stays inside the 100–160ms press-feedback budget and the 150–200ms hover budget.

## Repo conventions to follow

- Easing tokens live in `@theme static` at the top of `web/src/app/globals.css` (`--ease-out`, `--ease-in-out`, `--ease-drawer`). Use `var(--ease-out)`; do not add a new curve.
- `.press` stays inside the existing `@layer utilities { ... }` block, in the same position.

## Steps

1. In `web/src/app/globals.css`, replace the single line `transition: transform 160ms var(--ease-out);` inside `.press { ... }` (currently line 162) with the three lines from **Target**. Leave `.press:active` untouched.

## Boundaries

- Do NOT edit any component's `transition-*` classes; they become harmless.
- Do NOT move `.press` out of `@layer utilities`, and do not convert it to `@utility`.
- Do NOT add `opacity` or `all` to the property list.
- If the `.press` block does not read exactly as quoted in **Problem**, STOP and report. Line numbers are hints; the quoted code is the anchor.

## Verification

- **Mechanical**: `cd web && npx tsc --noEmit -p . && npm run lint` both exit 0.
- **Computed style**: on `/`, in DevTools console: `getComputedStyle(document.querySelector('a[href="/shop"].press')).transitionProperty` returns `transform, color, background-color, border-color, box-shadow`.
- **Feel check** (desktop, mouse):
  - Hover "Shop the shelf": the cocoa background eases to brown over ~160ms instead of snapping.
  - Hover "Start a work order" (paper button): the shadow grows smoothly.
  - Hover the header heart/user/bag icons: the round wash fades in.
  - Press and hold any button: it still scales to 0.97, and releasing springs back with no delay.
  - DevTools > Animations at 10%: the hover colour change and the press scale both interpolate; neither jumps.
- **Done when**: the computed-style check passes and all four feel checks hold.
