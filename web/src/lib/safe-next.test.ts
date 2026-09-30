import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it.each([
    ["/account", "/account"],
    ["/checkout?step=2", "/checkout?step=2"],
    ["/p/mug-rug#reviews", "/p/mug-rug#reviews"],
    ["/order/FB-1001", "/order/FB-1001"],
  ])("keeps the same-site path %s", (input, out) => {
    expect(safeNext(input)).toBe(out);
  });

  it.each([
    ["nothing", undefined],
    ["empty", ""],
    ["null", null],
    ["a full URL", "https://evil.com/x"],
    ["protocol-relative", "//evil.com"],
    ["backslash trick", "/\\evil.com"],
    ["backslash anywhere", "/ok\\..\\evil"],
    ["tab between slashes", "/\t/evil.com"],
    ["newline between slashes", "/\n/evil.com"],
    ["carriage return", "/\r/evil.com"],
    ["other control character", "/\u0001/evil.com"],
    ["no leading slash", "evil.com"],
    ["javascript url", "javascript:alert(1)"],
    ["far too long", `/${"a".repeat(3000)}`],
  ])("refuses %s", (_label, input) => {
    expect(safeNext(input as string | null | undefined)).toBeUndefined();
  });

  it("never returns an off-site target for any leading-slash sequence a browser would collapse", () => {
    const attempts = ["/\t\t/evil.com", "/ /evil.com", "/%09/evil.com", "/%2f/evil.com", "/%5cevil.com"];
    for (const a of attempts) {
      const out = safeNext(a);
      if (out !== undefined) expect(new URL(out, "https://shop.example").origin).toBe("https://shop.example");
    }
  });
});
