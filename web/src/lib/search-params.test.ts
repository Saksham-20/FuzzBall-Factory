import { describe, expect, it } from "vitest";
import { first } from "./search-params";

describe("first", () => {
  it("passes a single value through and takes the first of repeats", () => {
    expect(first("a")).toBe("a");
    expect(first(["a", "b"])).toBe("a");
    expect(first(undefined)).toBeUndefined();
    expect(first([])).toBeUndefined();
  });
});
