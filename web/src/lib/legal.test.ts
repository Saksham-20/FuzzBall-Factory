import { describe, expect, it } from "vitest";
import { LEGAL, legalReady, missingLegal, type LegalDetails } from "@/lib/legal";

const filled: LegalDetails = {
  legalName: "Example Studio",
  constitution: "Sole proprietorship",
  addressLines: ["1 Test Road", "Bengaluru, Karnataka 560001"],
  gstRegistered: false,
  gstin: null,
  phone: "+91 90000 00000",
  customerCareHours: "Mon to Sat, 10:00 to 18:00 IST",
  jurisdiction: "Bengaluru, Karnataka",
  grievance: { name: "A. Maker", designation: "Proprietor", email: "grievance@example.com", phone: "+91 90000 00001", hours: "Mon to Fri" },
  ipContactEmail: "ip@example.com",
  euRepresentative: null,
  courierPartner: null,
  darkPatternAudit: null,
};

describe("legal details", () => {
  it("is not ready until the owner supplies the facts", () => {
    expect(legalReady()).toBe(false);
    expect(missingLegal(LEGAL)).toContain("legalName");
    expect(missingLegal(LEGAL)).toContain("grievance.name");
  });

  it("is ready when every required fact is present; a GSTIN is only needed when registered", () => {
    expect(legalReady(filled)).toBe(true);
    expect(missingLegal({ ...filled, gstRegistered: true })).toEqual(["gstin"]);
    expect(legalReady({ ...filled, gstRegistered: true, gstin: "29ABCDE1234F1Z5" })).toBe(true);
  });

  it("treats an unanswered GST question as missing, not as 'not registered'", () => {
    expect(missingLegal({ ...filled, gstRegistered: null })).toEqual(["gstRegistered"]);
  });
});
