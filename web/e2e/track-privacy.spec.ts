import { expect, test } from "@playwright/test";

/** The landing page's tracking form must never put the phone number in the URL (history, logs, referrers). */
test("tracking from the landing page keeps the phone number out of the URL", async ({ page }) => {
  await page.goto("/");
  await page.locator("#track-order").fill("FB-1023");
  await page.locator("#track-phone").fill("9811122233");
  await page.getByRole("button", { name: "Track my order" }).click();

  await expect(page).toHaveURL(/\/track$/);
  expect(page.url()).not.toContain("9811122233");
  expect(page.url()).not.toContain("phone");
  // The pair was handed over, so the lookup fields are filled in (and the hand-off is used up).
  await expect(page.getByLabel("Order number")).toHaveValue("FB-1023");
  await expect(page.getByLabel("Phone or email")).toHaveValue("9811122233");
  expect(await page.evaluate(() => sessionStorage.getItem("fbf:track-handoff"))).toBeNull();
});

test("the track page is not indexed, and a phone in the query string is ignored", async ({ page }) => {
  await page.goto("/track?order=FB-1023&phone=9811122233");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByLabel("Order number")).toHaveValue("FB-1023");
  await expect(page.getByLabel("Phone or email")).toHaveValue("");
});
