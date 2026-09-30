import { describe, expect, it } from "vitest";
import { postalFieldError } from "./postal";

// The same cases are in api/src/shipping/postal.spec.ts: the two tables must agree.
describe("postalFieldError", () => {
  it.each([
    ["US", "94103"], ["US", "94103-1234"], ["CA", "M5V 3L9"], ["CA", "m5v3l9"], ["GB", "N10 2LE"], ["GB", "SW1A 1AA"], ["GB", "EC1A 1BB"],
    ["IE", "D02 X285"], ["AU", "2000"], ["NZ", "6011"], ["SG", "238823"], ["MY", "50450"], ["DE", "10115"], ["FR", "75001"],
    ["IT", "00184"], ["ES", "28013"], ["NL", "1012 AB"], ["NP", "44600"], ["LK", "00100"], ["BD", "1205"], ["SA", "12271"],
    ["AE", "000"], ["JP", "100-0001"], ["BR", "01310-100"], ["OTHER", "AB12"],
  ])("%s %s is fine", (country, code) => expect(postalFieldError(country, code)).toBeUndefined());

  it.each([
    ["US", "9410"], ["US", "ABCDE"], ["CA", "D5V 3L9"], ["GB", "N10"], ["GB", "12345"], ["AU", "20000"], ["SG", "2388"], ["DE", "1011"],
    ["NL", "1012"], ["JP", ""], ["JP", "   "], ["BR", "!!"], ["AE", "ab"],
  ])("%s %s is refused", (country, code) => expect(postalFieldError(country, code)).toEqual(expect.any(String)));
});
