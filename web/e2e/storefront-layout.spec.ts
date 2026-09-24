import { expect, test, type Page } from "@playwright/test";

/**
 * Layout regressions from the landing polish, measured where they broke: phone widths.
 * The suite runs with reduced motion (see playwright.config.ts), so everything is at rest.
 */

async function open(page: Page, width: number, path: string) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

test.describe("ticket heads", () => {
  for (const width of [320, 360, 390]) {
    test(`stay on one line in the shop grid at ${width}px`, async ({ page }) => {
      await open(page, width, "/shop");
      const heads = page.locator("[data-ticket-head]");
      await expect(heads.first()).toBeVisible();
      const rows = await heads.evaluateAll((els) =>
        els.map((head) => {
          const labels = [...head.children].map((c) => c.getBoundingClientRect());
          const size = parseFloat(getComputedStyle(head).fontSize);
          const heart = head.parentElement?.querySelector("button[aria-pressed]")?.getBoundingClientRect();
          return {
            // One row, one line each: a wrapped label is about twice as tall.
            oneLine: labels.every((r) => Math.abs(r.top - labels[0].top) < 2 && r.height < size * 2.2),
            // The wishlist button sits below the head; a taller head would slide under it.
            clearOfHeart: !heart || heart.top >= head.getBoundingClientRect().bottom,
          };
        }),
      );
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect(row).toEqual({ oneLine: true, clearOfHeart: true });
    });
  }
});

test.describe("hero", () => {
  for (const width of [320, 344, 360, 375, 390, 414]) {
    test(`batch ticket leaves the thread's loose end showing at ${width}px`, async ({ page }) => {
      await open(page, width, "/");
      const start = await page.locator("[data-thread-start]").boundingBox();
      const ticket = await page.locator(".hero-ball .ticket-swing").boundingBox();
      expect(start).not.toBeNull();
      expect(ticket).not.toBeNull();
      const covered =
        start!.x >= ticket!.x &&
        start!.x <= ticket!.x + ticket!.width &&
        start!.y >= ticket!.y &&
        start!.y <= ticket!.y + ticket!.height;
      expect(covered, `thread starts at (${start!.x}, ${start!.y}), under the ticket`).toBe(false);
    });
  }
});

test.describe("thread", () => {
  for (const width of [280, 320, 360, 390]) {
    test(`heads straight for the gutter, never doubling back, at ${width}px`, async ({ page }) => {
      await open(page, width, "/");
      const line = page.locator("[data-thread-line]");
      await expect.poll(() => line.evaluate((p) => (p as SVGPathElement).getTotalLength())).toBeGreaterThan(200);
      // x along the crossing from the ball to the gutter corner (the first 40px of drop).
      const xs = await line.evaluate((el) => {
        const p = el as SVGPathElement;
        const start = p.getPointAtLength(0);
        const out: number[] = [];
        for (let d = 0; d < p.getTotalLength(); d += 2) {
          const pt = p.getPointAtLength(d);
          if (pt.y > start.y + 40) break;
          out.push(pt.x);
        }
        return out;
      });
      expect(xs.length).toBeGreaterThan(5);
      for (let i = 1; i < xs.length; i++) expect(xs[i], `x turns back right at sample ${i}`).toBeLessThanOrEqual(xs[i - 1] + 1);
    });
  }
});

test.describe("page width", () => {
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    test(`home never scrolls sideways at ${width}px`, async ({ page }) => {
      await open(page, width, "/");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe("pegged photo line", () => {
  // The reveal is the thing under test here, so motion stays on.
  test.use({ reducedMotion: "no-preference" });

  test("shows every photo on a phone, including ones scrolled out of the strip", async ({ page }) => {
    await open(page, 390, "/");
    await page.locator("#ig-h").scrollIntoViewIfNeeded();
    const photos = page.locator('section[aria-labelledby="ig-h"] li.hang');
    await expect(photos).toHaveCount(6);
    await expect
      .poll(() => photos.evaluateAll((els) => els.filter((el) => getComputedStyle(el).opacity !== "1").length), { timeout: 5_000 })
      .toBe(0);
  });
});
