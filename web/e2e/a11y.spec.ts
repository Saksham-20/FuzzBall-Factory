import { expect, test } from "@playwright/test";

/**
 * Accessibility fixes from the 2026-09-23 design audit: focus ring and badge contrast
 * (FINDING-012, -013) and a pause button for the tape (FINDING-014). Colours are read
 * from computed styles, so a token change that breaks them fails here.
 */

/** WCAG contrast ratio of two computed `rgb()` colours. */
function contrast(a: string, b: string) {
  const luminance = (colour: string) => {
    const m = colour.match(/^rgba?\((\d+), (\d+), (\d+)/);
    if (!m) throw new Error(`not an rgb() colour: ${colour}`);
    const [r, g, bl] = m.slice(1).map((v) => {
      const c = Number(v) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test("the focus ring stands out on the cocoa footer", async ({ page }) => {
  await page.goto("/");
  const link = page.locator("footer").getByRole("link", { name: "FAQ" });
  await link.focus();
  const ring = await link.evaluate((el) => ({
    shown: el.matches(":focus-visible"),
    colour: getComputedStyle(el).outlineColor,
    ground: getComputedStyle(el.closest("footer")!).backgroundColor,
  }));
  expect(ring.shown).toBe(true);
  // Non-text contrast: a focus ring needs 3:1 against what it sits on.
  expect(contrast(ring.colour, ring.ground)).toBeGreaterThanOrEqual(3);
});

test("the focus ring stands out in the maker's cocoa message bubbles", async ({ page }) => {
  // The mock data layer's admin. WO-021 has a maker message with a photo attached.
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@fuzzball.test");
  await page.getByLabel("Password", { exact: true }).fill("fuzzball123");
  await page.getByLabel("Password", { exact: true }).press("Enter");
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));

  await page.goto("/admin/custom/WO-021");
  const photo = page.getByText("The first penguin is done!").locator("a").first();
  await photo.focus();
  const ring = await photo.evaluate((el) => {
    let ground = el.parentElement!;
    while (getComputedStyle(ground).backgroundColor === "rgba(0, 0, 0, 0)") ground = ground.parentElement!;
    return {
      shown: el.matches(":focus-visible"),
      colour: getComputedStyle(el).outlineColor,
      ground: getComputedStyle(ground).backgroundColor,
    };
  });
  expect(ring.shown).toBe(true);
  expect(contrast(ring.colour, ring.ground)).toBeGreaterThanOrEqual(3);
});

test("the 'Ready to ship' badge on shop tickets reads at AA", async ({ page }) => {
  await page.goto("/shop");
  const badges = page.locator(":has(> [data-ticket-head])").getByText("Ready to ship", { exact: true });
  await expect(badges.first()).toBeVisible();
  const colours = await badges.evaluateAll((els) =>
    els.map((el) => {
      const c = getComputedStyle(el);
      return { fg: c.color, bg: c.backgroundColor };
    }),
  );
  // 11px text, so the small-text minimum applies.
  for (const { fg, bg } of colours) expect(contrast(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
});

test.describe("tape", () => {
  // The tape only moves when motion is allowed.
  test.use({ reducedMotion: "no-preference" });

  test("its pause button stops it, and it stays stopped on the next page", async ({ page }) => {
    await page.goto("/");
    const pause = page.getByRole("button", { name: "Pause scrolling text" });
    const playState = () => page.locator(".tape-track").first().evaluate((el) => getComputedStyle(el).animationPlayState);
    await expect(pause).toHaveAttribute("aria-pressed", "false");
    expect(await playState()).toBe("running");

    await pause.click();
    await expect(pause).toHaveAttribute("aria-pressed", "true");
    expect(await playState()).toBe("paused");

    // Desktop width, so the sign-in page shows its kraft panel and that panel's tape.
    await page.goto("/login");
    await expect(pause).toHaveAttribute("aria-pressed", "true");
    expect(await playState()).toBe("paused");

    await pause.click();
    await expect(pause).toHaveAttribute("aria-pressed", "false");
    expect(await playState()).toBe("running");
  });
});

test("with reduced motion the tape stands still and needs no pause button", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".tape-track").first()).toHaveCSS("animation-name", "none");
  await expect(page.getByRole("button", { name: "Pause scrolling text" })).toBeHidden();
});

for (const path of ["/", "/login"]) {
  test(`no control hides inside an aria-hidden block on ${path}`, async ({ page }) => {
    await page.goto(path);
    const hidden = page.locator('[aria-hidden="true"] :is(a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]))');
    expect(await hidden.count()).toBe(0);
  });
}
