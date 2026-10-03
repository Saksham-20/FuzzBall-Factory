import { expect, test } from "@playwright/test";

test("the track page is not indexed, and a phone in the query string is ignored", async ({ page }) => {
  await page.goto("/track?order=FB-1023&phone=9811122233");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByLabel("Order number")).toHaveValue("FB-1023");
  await expect(page.getByLabel("Phone or email")).toHaveValue("");
});
