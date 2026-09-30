import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { decodeParam, routeParam } from "./route-param";

describe("route params", () => {
  it("decodes normal segments", () => {
    expect(decodeParam("FF-1042")).toBe("FF-1042");
    expect(decodeParam("a%20b")).toBe("a b");
  });

  it("returns null for malformed encoding", () => {
    expect(decodeParam("%E0%A4%A")).toBeNull();
    expect(decodeParam("%")).toBeNull();
  });

  it("routeParam turns malformed encoding into a 404", () => {
    expect(routeParam("ok")).toBe("ok");
    expect(() => routeParam("%")).toThrow("NEXT_NOT_FOUND");
  });
});
