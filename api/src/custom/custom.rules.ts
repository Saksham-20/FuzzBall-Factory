import { validationFailed } from '../common/errors.js';

/** Customers may counter a quote at most this many times per work order. */
export const MAX_COUNTERS = 2;
/** Upper bound on any single quote (rupees): a typo guard, not a business rule. */
export const MAX_QUOTE_PRICE = 1_000_000;

export interface PricedQuote {
  price: number;
  depositPct: number;
}

/** Advance to start the piece, in whole rupees. */
export const depositAmount = (q: PricedQuote): number => Math.round((q.price * q.depositPct) / 100);
/** Remainder due before shipping. deposit + balance always equals price. */
export const balanceAmount = (q: PricedQuote): number => q.price - depositAmount(q);

export const isQuoteExpired = (q: { status: string; validUntil: Date }, now: Date = new Date()): boolean =>
  q.status === 'SENT' && q.validUntil.getTime() < now.getTime();

export const countersRemaining = (used: number): number => Math.max(0, MAX_COUNTERS - used);

/** True when this change request goes beyond the revisions included in the quote (the maker may charge extra). */
export const revisionExceeded = (previousChangeRequests: number, includedRevisions: number): boolean => previousChangeRequests >= includedRevisions;

export interface BreakdownLine {
  label: string;
  amount: number;
}

/** Price = sum of the lines. Rejects empty/zero quotes and absurd totals. */
export function priceFromBreakdown(lines: BreakdownLine[]): number {
  const price = lines.reduce((sum, l) => sum + l.amount, 0);
  if (lines.length === 0 || !(price > 0)) throw validationFailed({ breakdown: 'Add at least one priced line.' }, 'Add at least one priced line.');
  if (price > MAX_QUOTE_PRICE) throw validationFailed({ breakdown: 'That total looks too high. Check the amounts.' });
  return price;
}

/**
 * Rescales a breakdown to a new total (used when a counter-offer is accepted) so the lines still sum to the
 * price exactly: rounding drift goes onto the largest line.
 */
export function scaleBreakdown(lines: BreakdownLine[], from: number, to: number): BreakdownLine[] {
  if (lines.length === 0 || from <= 0) return [{ label: 'Agreed price', amount: to }];
  const scaled = lines.map((l) => ({ ...l, amount: Math.round((l.amount * to) / from) }));
  const drift = to - scaled.reduce((s, l) => s + l.amount, 0);
  if (drift !== 0) {
    let big = 0;
    scaled.forEach((l, i) => {
      if (l.amount > scaled[big].amount) big = i;
    });
    scaled[big] = { ...scaled[big], amount: scaled[big].amount + drift };
  }
  return scaled;
}

export const addDays = (from: Date, days: number): Date => new Date(from.getTime() + days * 86_400_000);

export const rupees = (n: number): string => `₹${n.toLocaleString('en-IN')}`;
