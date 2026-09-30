import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Automated accessibility scan (axe, WCAG 2.1 A/AA rules) of the pages a shopper meets, in mock mode. Axe finds
 * roughly a third of real problems (missing names, contrast, roles, landmarks); the manual checks stay in a11y.spec.ts.
 */
const PAGES = [
  ["home", "/"],
  ["shop", "/shop"],
  ["a shelf", "/shop/plushies"],
  ["a product", "/p/rosie-bear"],
  ["cart", "/cart"],
  ["checkout", "/checkout"],
  ["work orders", "/custom"],
  ["track an order", "/track"],
  ["log in", "/login"],
  ["sign up", "/signup"],
  ["contact", "/contact"],
  ["faq", "/faq"],
  ["a policy", "/policies/refund"],
  ["not found", "/no-such-page"],
] as const;

for (const [name, path] of PAGES) {
  test(`no axe violations on ${name}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    // Decorative watermark words are aria-hidden and exempt from WCAG contrast ("pure decoration"); axe cannot know that.
    const violations = results.violations
      .map((v) => (v.id === "color-contrast" ? { ...v, nodes: v.nodes.filter((n) => !n.html.includes('aria-hidden="true"')) } : v))
      .filter((v) => v.nodes.length > 0);
    const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target.join(" ")}`);
    expect(summary, summary.join("\n")).toEqual([]);
  });
}
