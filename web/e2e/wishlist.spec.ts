import { expect, test } from "@playwright/test";

/** Saving a piece: the heart is a real toggle button, and saved pieces show on the wishlist page (mock mode). */
test("the heart toggles on a product page and the piece shows in the wishlist", async ({ page }) => {
  await page.goto("/p/pocket-penguins");
  const save = page.getByRole("button", { name: /Save Pocket Penguin Keychain to wishlist/ });
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await save.click();
  const remove = page.getByRole("button", { name: /Remove Pocket Penguin Keychain from wishlist/ });
  await expect(remove).toHaveAttribute("aria-pressed", "true");

  // Survives a reload (this device's own list while signed out).
  await page.reload();
  await expect(page.getByRole("button", { name: /Remove Pocket Penguin Keychain from wishlist/ })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("link", { name: /Wishlist, 1 saved/ }).first().click();
  await expect(page).toHaveURL(/\/wishlist$/);
  await expect(page.getByText("Pocket Penguin Keychain").first()).toBeVisible();
});
