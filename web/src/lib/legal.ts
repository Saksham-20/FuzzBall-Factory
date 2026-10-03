/**
 * PLACEHOLDER(legal-details): the one place the seller's legal facts live. Every value starts `null` and is filled in
 * when the owner supplies it; every page reads it from here (never a literal), and a `null` renders as a bracketed
 * stand-in that the launch build refuses to ship (see docs/PLACEHOLDERS.md, docs/LEGAL_REVIEW.md).
 */
export interface LegalDetails {
  /** Name the business is registered under. */
  legalName: string | null;
  /** e.g. "Sole proprietorship". */
  constitution: string | null;
  /** Registered address, one string per line (street, city/state/PIN). */
  addressLines: string[] | null;
  /** True when registered for GST, false when not, null until the owner confirms. Decides the tax wording. */
  gstRegistered: boolean | null;
  gstin: string | null;
  /** Customer-care phone (E-Commerce Rules r.4(2)). */
  phone: string | null;
  /** When the maker answers, e.g. "Mon to Sat, 10:00 to 18:00 IST". */
  customerCareHours: string | null;
  /** Court city for disputes, e.g. "Bengaluru, Karnataka". */
  jurisdiction: string | null;
  grievance: {
    name: string | null;
    designation: string | null;
    /** A dedicated address if there is one; the shop address otherwise. */
    email: string | null;
    phone: string | null;
    hours: string | null;
  };
  /** Where copyright and trademark notices go. */
  ipContactEmail: string | null;
  /** EU representative (GDPR Art 27 / GPSR responsible person). Null = none appointed. */
  euRepresentative: string | null;
  /** Courier partner or aggregator named in the shipping policy. */
  courierPartner: string | null;
  /** ISO date of the last signed dark-pattern self-audit; null = none done. The grievance page shows the certificate only once set. */
  darkPatternAudit: string | null;
}

export const LEGAL: LegalDetails = {
  legalName: null,
  constitution: null,
  addressLines: null,
  gstRegistered: null,
  gstin: null,
  phone: null,
  customerCareHours: null,
  jurisdiction: null,
  grievance: { name: null, designation: null, email: null, phone: null, hours: null },
  ipContactEmail: null,
  euRepresentative: null,
  courierPartner: null,
  darkPatternAudit: null,
};

/** Names of the required facts that are still missing (empty = ready to publish). */
export function missingLegal(l: LegalDetails = LEGAL): string[] {
  const missing: string[] = [];
  const need = (ok: boolean, name: string) => {
    if (!ok) missing.push(name);
  };
  need(!!l.legalName, "legalName");
  need(!!l.addressLines?.length, "addressLines");
  need(l.gstRegistered !== null, "gstRegistered");
  need(l.gstRegistered !== true || !!l.gstin, "gstin");
  need(!!l.phone, "phone");
  need(!!l.customerCareHours, "customerCareHours");
  need(!!l.jurisdiction, "jurisdiction");
  need(!!l.grievance.name, "grievance.name");
  need(!!l.grievance.designation, "grievance.designation");
  need(!!l.grievance.email, "grievance.email");
  need(!!l.grievance.phone, "grievance.phone");
  need(!!l.grievance.hours, "grievance.hours");
  need(!!l.ipContactEmail, "ipContactEmail");
  return missing;
}

export const legalReady = (l: LegalDetails = LEGAL): boolean => missingLegal(l).length === 0;
