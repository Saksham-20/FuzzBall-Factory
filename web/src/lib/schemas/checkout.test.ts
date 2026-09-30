import { describe, expect, it } from "vitest";
import { CHECKOUT_DEFAULTS, checkoutSchema, type CheckoutValues } from "./checkout";

const valid: CheckoutValues = {
  ...CHECKOUT_DEFAULTS,
  name: "Maya Iyer",
  email: "maya@example.com",
  phone: "+91 98765 43210",
  recipient: "Maya Iyer",
  line1: "12 Lane Road",
  city: "Pune",
  state: "Maharashtra",
  postalCode: "411001",
  policy: true,
};

const issues = (values: Partial<CheckoutValues>) => {
  const r = checkoutSchema.safeParse({ ...valid, ...values });
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("checkout schema", () => {
  it("accepts a complete Indian order", () => {
    expect(issues({})).toEqual([]);
  });

  it("requires the policy box, a name and a sensible email", () => {
    expect(issues({ policy: false })).toContain("policy");
    expect(issues({ name: "M" })).toContain("name");
    expect(issues({ email: "maya@" })).toContain("email");
  });

  it("checks the pincode and state for India", () => {
    expect(issues({ postalCode: "41100" })).toContain("postalCode");
    expect(issues({ postalCode: "011001" })).toContain("postalCode"); // pincodes never start with 0
    expect(issues({ state: "" })).toContain("state");
    expect(issues({ state: "Narnia" })).toContain("state");
  });

  it("is looser abroad: any postal code of 3+ characters, no state needed", () => {
    expect(issues({ country: "GB", postalCode: "SW1A 1AA", state: "" })).toEqual([]);
    expect(issues({ country: "GB", postalCode: "SW", state: "" })).toContain("postalCode");
  });

  it("caps the gift note", () => {
    expect(issues({ giftNote: "x".repeat(201) })).toContain("giftNote");
    expect(issues({ giftNote: "x".repeat(200) })).toEqual([]);
  });
});
