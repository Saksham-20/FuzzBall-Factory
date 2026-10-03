import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** The support inbox end to end in mock mode: a customer writes, the maker answers and resolves, the customer sees it. */

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("fuzzball123");
  await page.getByLabel("Password", { exact: true }).press("Enter");
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test("a complaint gets a reference, the maker answers and resolves it, and the customer sees the outcome", async ({ page, context }) => {
  await page.goto("/policies/grievance");
  const form = page.getByRole("form", { name: "Complaint" });
  await form.getByLabel("Your name").fill("Guest Gita");
  await form.getByLabel("Email").fill("gita@example.com");
  await form.getByLabel("Topic").selectOption("refund");
  await form.getByLabel(/What happened/).fill("My refund has not arrived after two weeks.");

  // The consent box starts unticked and the form will not go without it.
  const consent = form.getByLabel("I have read the privacy notice above.");
  await expect(consent).not.toBeChecked();
  await form.getByRole("button", { name: "Send complaint" }).click();
  await expect(form.getByText("Please confirm you have read the privacy notice.")).toBeVisible();
  await consent.check();
  await form.getByRole("button", { name: "Send complaint" }).click();

  await expect(page.getByText(/GRV-\d{4}/).first()).toBeVisible();
  const number = /GRV-\d{4}/.exec(await page.getByRole("status").filter({ hasText: "GRV-" }).innerText())![0];

  // The link on the confirmation opens the request without signing in; the customer can write again.
  await page.getByRole("link", { name: "Open your request" }).click();
  await expect(page.getByRole("heading", { level: 1, name: number })).toBeVisible();
  await expect(page.getByText("My refund has not arrived after two weeks.")).toBeVisible();
  await page.getByLabel("Your reply").fill("It has been 15 days now.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByText("It has been 15 days now.")).toBeVisible();
  const ticketUrl = page.url();
  const customerScan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(customerScan.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);

  // The maker finds it, leaves a private note, replies, and resolves it with a note.
  await context.clearCookies();
  await signIn(page, "admin@fuzzball.test");
  await page.goto("/admin/support");
  await expect(page.getByRole("heading", { level: 1, name: "Support" })).toBeVisible();
  await page.getByRole("link", { name: number }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(number);

  await page.getByLabel("Private note").check();
  await page.getByLabel("Note", { exact: true }).fill("Check the Razorpay dashboard first.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Private note (not sent)")).toBeVisible();

  await page.getByLabel("Reply (emailed)").check();
  await page.getByLabel("Your reply").fill("Sorry about the wait, I am chasing the bank today.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByText("Sorry about the wait, I am chasing the bank today.")).toBeVisible();

  await page.getByRole("button", { name: "Resolve" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Resolve" }).click();
  await expect(dialog.getByText("Say what was done, in a few words.")).toBeVisible();
  await dialog.getByLabel("What was done").fill("Refund of the full amount sent to the original payment method.");
  await dialog.getByRole("button", { name: "Resolve" }).click();
  await expect(page.getByText("Resolution:")).toBeVisible();

  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);

  // Back as the customer: the private note is hidden, the outcome is shown.
  await context.clearCookies();
  await page.goto(ticketUrl);
  await expect(page.getByText("Sorry about the wait, I am chasing the bank today.")).toBeVisible();
  await expect(page.getByText("Check the Razorpay dashboard first.")).toHaveCount(0);
  await expect(page.getByText("Refund of the full amount sent to the original payment method.").first()).toBeVisible();
});

test("the maker logs a WhatsApp complaint with an earlier date and sees the clocks start then", async ({ page }) => {
  await signIn(page, "admin@fuzzball.test");
  await page.goto("/admin/support");
  await page.getByRole("button", { name: "Log a request" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Customer name").fill("Walk-in Wren");
  await dialog.getByLabel("What they said").fill("The parcel is late, she said on WhatsApp.");
  // Five days ago, in the browser's own time, as a datetime-local value.
  const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000);
  fiveDaysAgo.setMinutes(fiveDaysAgo.getMinutes() - fiveDaysAgo.getTimezoneOffset());
  await dialog.getByLabel("When they wrote").fill(fiveDaysAgo.toISOString().slice(0, 16));
  await dialog.getByRole("button", { name: "Log it" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("GRV-");
  await expect(page.getByText("The parcel is late, she said on WhatsApp.")).toBeVisible();
  // Answered on WhatsApp already, so the 48 hour clock is done; the one-month clock started five days ago.
  await expect(page.getByText(/2[45] days left/)).toBeVisible();
});

test("a signed-in customer finds their request under Help requests", async ({ page }) => {
  await signIn(page, "maya@example.com");
  await page.goto("/contact");
  const form = page.getByRole("form", { name: "Message" });
  // The signed-in customer's name and email are filled in for them.
  await expect(form.getByLabel("Your name")).toHaveValue("Maya Iyer");
  await expect(form.getByLabel("Email")).toHaveValue("maya@example.com");
  await form.getByLabel("Message", { exact: true }).fill("Do you make bunny plushies in blue?");
  await form.getByLabel("I have read the privacy notice above.").check();
  await form.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/SUP-\d{4}/).first()).toBeVisible();

  await page.goto("/account/support");
  await expect(page.getByRole("heading", { level: 1, name: "Help requests" })).toBeVisible();
  await expect(page.getByText(/Message: general/)).toBeVisible();
});
