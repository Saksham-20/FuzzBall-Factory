import { describe, expect, it } from "vitest";
import { BLOCKED_COUNTRIES, COUNTRIES, countryName } from "./countries";

describe("country list", () => {
  it("starts with India, has unique ISO-shaped codes, and offers no blocked country", () => {
    expect(COUNTRIES[0]).toEqual({ code: "IN", name: "India" });
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
    for (const blocked of BLOCKED_COUNTRIES) expect(codes).not.toContain(blocked);
  });

  it("covers every country the default shipping zones name", () => {
    for (const code of ["NP", "LK", "BD", "AE", "SA", "QA", "GB", "DE", "FR", "NL", "IT", "ES", "IE", "US", "CA", "AU", "NZ", "SG", "MY"]) {
      expect(COUNTRIES.some((c) => c.code === code)).toBe(true);
    }
  });

  it("blocks the same four countries as the API", () => {
    expect([...BLOCKED_COUNTRIES].sort()).toEqual(["CU", "IR", "KP", "SY"]);
  });

  it("names codes, including the legacy OTHER and unknown ones", () => {
    expect(countryName("GB")).toBe("United Kingdom");
    expect(countryName("OTHER")).toBe("Other country");
    expect(countryName("ZZ")).toBe("ZZ");
  });
});
