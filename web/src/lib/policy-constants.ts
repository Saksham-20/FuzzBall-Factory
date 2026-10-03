/**
 * The numbers the cancellation and refund policy promises. The policy page and the product page both read them from
 * here, so the two can never disagree (docs/LEGAL_REVIEW.md, refund.tsx). PLACEHOLDER(policy-draft): the maker confirms them.
 */
export const POLICY = {
  /** Change-of-mind exchange or refund on an unused ready-to-ship piece, and notice of transit damage or a wrong item. */
  returnWindowDays: 7,
  /** Notice of a manufacturing defect: the statutory floor for defective goods (Consumer Protection Act 2019, s.2(47)). */
  defectWindowDays: 30,
  /** Withdrawal right of EU and UK buyers on non-personalised items (Directive 2011/83/EU art 9; UK Consumer Contracts Regulations). */
  euWithdrawalDays: 14,
  /** Days the buyer has to pay the balance of a work order after the piece is ready, before we may cancel. */
  balanceDueDays: 14,
  /** Refund start and arrival, in business days. */
  refundStartBusinessDays: 2,
  refundArrival: "5 to 7 business days",
} as const;
