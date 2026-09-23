/** Date the draft legal text was last edited. Update whenever a policy changes. */
export const LEGAL_UPDATED = "2026-09-21";

export const LEGAL_UPDATED_LABEL = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Kolkata",
}).format(new Date(`${LEGAL_UPDATED}T12:00:00+05:30`));
