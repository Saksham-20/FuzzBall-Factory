import { describe, expect, it } from "vitest";
import { assertBuildEnv, buildEnvProblems, PLACEHOLDER_WHATSAPP } from "./build-env";

const real = {
  NEXT_PUBLIC_USE_MOCK: "false",
  NEXT_PUBLIC_API_URL: "https://api.example.com",
  NEXT_PUBLIC_SITE_URL: "https://shop.example.com",
};
const launch = { ...real, LAUNCH_BUILD: "true", NEXT_PUBLIC_WHATSAPP: "919876543210" };

describe("buildEnvProblems", () => {
  it("requires NEXT_PUBLIC_USE_MOCK to be chosen", () => {
    expect(buildEnvProblems({})).toHaveLength(1);
    expect(buildEnvProblems({ NEXT_PUBLIC_USE_MOCK: "" })[0]).toMatch(/NEXT_PUBLIC_USE_MOCK must be set/);
    expect(buildEnvProblems({ NEXT_PUBLIC_USE_MOCK: "yes" })[0]).toMatch(/NEXT_PUBLIC_USE_MOCK must be set/);
  });

  it("lets a demo build keep sample values", () => {
    expect(buildEnvProblems({ NEXT_PUBLIC_USE_MOCK: "true" })).toEqual([]);
  });

  it("accepts a complete real configuration (a staging build may keep the placeholder WhatsApp number)", () => {
    expect(buildEnvProblems(real)).toEqual([]);
  });

  it("real mode needs public URLs", () => {
    expect(buildEnvProblems({ NEXT_PUBLIC_USE_MOCK: "false" })).toHaveLength(2);
    expect(buildEnvProblems({ ...real, NEXT_PUBLIC_API_URL: "http://localhost:4000" })[0]).toMatch(/localhost/);
    expect(buildEnvProblems({ ...real, NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000" })[0]).toMatch(/127\.0\.0\.1/);
    expect(buildEnvProblems({ ...real, NEXT_PUBLIC_SITE_URL: "shop.example.com" })[0]).toMatch(/not an absolute URL/);
  });

  it("a launch build also needs a real WhatsApp number", () => {
    expect(buildEnvProblems(launch)).toEqual([]);
    expect(buildEnvProblems({ ...launch, NEXT_PUBLIC_WHATSAPP: undefined })[0]).toMatch(/WHATSAPP is not set/);
    expect(buildEnvProblems({ ...launch, NEXT_PUBLIC_WHATSAPP: PLACEHOLDER_WHATSAPP })[0]).toMatch(/placeholder/);
    expect(buildEnvProblems({ ...launch, NEXT_PUBLIC_WHATSAPP: "+91 98765 43210" })[0]).toMatch(/digits only/);
  });
});

describe("assertBuildEnv", () => {
  it("throws one error listing every problem, and passes a good env", () => {
    expect(() => assertBuildEnv({ NEXT_PUBLIC_USE_MOCK: "false", LAUNCH_BUILD: "true" })).toThrowError(/API_URL[\s\S]*SITE_URL[\s\S]*WHATSAPP/);
    expect(() => assertBuildEnv(launch)).not.toThrow();
  });
});
