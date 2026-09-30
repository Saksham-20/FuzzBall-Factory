import { expect, test } from "@playwright/test";

/** A hand-mangled URL is a 404, never a crashed page. */
for (const path of ["/order/%", "/account/orders/%E0%A4%A", "/account/custom/%", "/custom/sent/%E0%A4%A"]) {
  test(`malformed percent-encoding in ${path} renders the 404`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Dropped a stitch" })).toBeVisible();
  });
}
