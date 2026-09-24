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

test.describe("address cards", () => {
  test("a long name gives way to the Default badge at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    // The mock data layer's sample customer.
    await page.goto("/login");
    await page.getByLabel("Email or phone").fill("maya@example.com");
    await page.getByLabel("Password", { exact: true }).fill("fuzzball123");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    await page.goto("/account/addresses");
    const card = page.locator("li", { has: page.getByText("Default", { exact: true }) });
    await card.getByRole("button", { name: /^Edit/ }).click();
    await page.getByLabel("Address name").fill("Grandma and Grandpa at Chennai"); // 30 characters, the form's limit
    await page.getByRole("button", { name: "Save changes" }).click();

    const head = card.locator("[data-ticket-head]");
    await expect(head).toContainText("Grandma and Grandpa at Chennai");
    const fit = await head.evaluate((el) => {
      const [label, badge] = [...el.children] as HTMLElement[];
      const ticket = el.parentElement!.getBoundingClientRect();
      const clip = getComputedStyle(label);
      return {
        // Longer than its box, and clipped with an ellipsis rather than spilling under the badge.
        labelCutShort: label.scrollWidth > label.clientWidth && clip.overflowX === "hidden" && clip.textOverflow === "ellipsis",
        badgeWhole: badge.scrollWidth <= badge.clientWidth + 0.5 && badge.getBoundingClientRect().right <= ticket.right + 0.5,
        sidewaysScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(fit).toEqual({ labelCutShort: true, badgeWhole: true, sidewaysScroll: 0 });
  });
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
