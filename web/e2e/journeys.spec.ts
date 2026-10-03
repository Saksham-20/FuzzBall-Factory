import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** The main paths a shopper and the maker take, end to end in mock mode (data lives in the browser, so runs are independent). */

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("fuzzball123");
  await page.getByLabel("Password", { exact: true }).press("Enter");
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test("a guest buys a ready-to-ship piece with cash on delivery and can track it", async ({ page }) => {
  await page.goto("/p/whale-red");
  await page.getByRole("button", { name: "Add to cart" }).first().click();

  await page.goto("/checkout");
  await page.getByLabel("Full name").fill("Test Shopper");
  await page.getByLabel("Email", { exact: true }).fill("shopper@example.com");
  await page.getByLabel("Phone or WhatsApp").fill("+91 98765 43210");
  await page.getByLabel("Recipient name").fill("Test Shopper");
  await page.getByLabel("House number and street").fill("12 Lane Road");
  await page.getByLabel("City or town").fill("Pune");
  await page.getByLabel("State", { exact: true }).selectOption("Maharashtra");
  await page.getByLabel("Pincode").fill("411001");
  await page.getByLabel("Cash on delivery").check();
  await page.getByLabel(/read the/i).check();
  await page.getByRole("button", { name: /Place order/ }).click();

  await expect(page).toHaveURL(/\/order\/FB-\d+/);
  const number = /FB-\d+/.exec(page.url())![0];
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // The same customer can look the order up with the phone they gave.
  await page.goto("/track");
  await page.getByLabel("Order number").fill(number);
  await page.getByLabel("Phone or email").fill("+91 98765 43210");
  await page.getByRole("button", { name: /Track/ }).click();
  await expect(page.getByText(number).first()).toBeVisible();
});

test("a customer signs in and sees their account; a wrong password says so", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("maya@example.com");
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByLabel("Password", { exact: true }).press("Enter");
  await expect(page.getByRole("alert").first()).toBeVisible();

  await signIn(page, "maya@example.com");
  await page.goto("/account");
  await expect(page.getByText("Maya").first()).toBeVisible();
});

test("the admin can open an order and a work order; a customer cannot reach the admin", async ({ page, context }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/); // signed out: sent to log in

  await signIn(page, "maya@example.com");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/); // a customer is not an admin

  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
  await signIn(page, "admin@fuzzball.test");
  await page.goto("/admin/orders");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/admin/custom/WO-021");
  await expect(page.getByText("The first whale is done!")).toBeVisible();

  // The operations screens open (the sample shop has no outbox or audit trail, so they say so) and pass an axe scan.
  for (const [path, heading, empty] of [["/admin/emails", "Emails", "Nothing has failed"], ["/admin/audit", "Audit log", "Nothing recorded"]] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText(empty)).toBeVisible();
    const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(scan.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  }
});

test("the work order form opens for a signed-in customer", async ({ page }) => {
  await signIn(page, "maya@example.com");
  await page.goto("/custom");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("an overseas order: zone rate, duties note, no cash on delivery, a postal code in the right shape, then paid online", async ({ page }) => {
  await page.goto("/p/whale-red");
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await page.goto("/checkout");
  await page.getByLabel("Full name").fill("Test Shopper");
  await page.getByLabel("Email", { exact: true }).fill("shopper@example.com");
  await page.getByLabel("Phone or WhatsApp").fill("+44 7700 900123");
  await page.getByLabel("Recipient name").fill("Test Shopper");
  await page.getByLabel("Country").selectOption("GB");
  await page.getByLabel("House number and street").fill("5 Rosebery Road");
  await page.getByLabel("City or town").fill("London");

  // The zone rate and the customs note show up; cash on delivery is not offered.
  await expect(page.getByText("International: UK & Europe").first()).toBeVisible();
  await expect(page.getByText(/Import duties, VAT and courier fees/)).toBeVisible();
  await expect(page.getByLabel("Cash on delivery")).toBeDisabled();

  // A US-shaped code is wrong for the UK: the field says so before anything is charged.
  await page.getByLabel("Postal code").fill("94103");
  await page.getByLabel(/read the/i).check();
  await page.getByRole("button", { name: /^Pay/ }).click();
  await expect(page.getByText(/looks like N10 2LE/)).toBeVisible();

  await page.getByLabel("Postal code").fill("N10 2LE");
  await page.getByRole("button", { name: /^Pay/ }).click();
  await page.getByRole("button", { name: "Pay successfully" }).click(); // the mock payment window
  await expect(page).toHaveURL(/\/order\/FB-\d+/);
});
