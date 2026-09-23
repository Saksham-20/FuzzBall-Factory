import { addDays, balanceAmount, countersRemaining, depositAmount, isQuoteExpired, MAX_COUNTERS, priceFromBreakdown, revisionExceeded, scaleBreakdown } from './custom.rules.js';

describe('quote money', () => {
  it('splits price into deposit + balance that always add up', () => {
    for (const price of [1, 99, 850, 1850, 2401, 2600, 99_999]) {
      for (const depositPct of [10, 30, 33, 50, 67, 100]) {
        const q = { price, depositPct };
        expect(depositAmount(q) + balanceAmount(q)).toBe(price);
        expect(Number.isInteger(depositAmount(q))).toBe(true);
      }
    }
    expect(depositAmount({ price: 1850, depositPct: 50 })).toBe(925);
    expect(depositAmount({ price: 2401, depositPct: 50 })).toBe(1201);
  });

  it('breakdown must sum to a positive price', () => {
    expect(priceFromBreakdown([{ label: 'Materials', amount: 500 }, { label: 'Time', amount: 1350 }])).toBe(1850);
    expect(() => priceFromBreakdown([])).toThrow();
    expect(() => priceFromBreakdown([{ label: 'Free', amount: 0 }])).toThrow();
    expect(() => priceFromBreakdown([{ label: 'Absurd', amount: 2_000_000 }])).toThrow();
  });

  it('rescaling a breakdown to a counter price keeps the sum exact', () => {
    const lines = [
      { label: 'Materials', amount: 555 },
      { label: 'Time', amount: 1110 },
      { label: 'Packaging', amount: 185 },
    ];
    for (const to of [1, 999, 1500, 1701, 1849]) {
      const out = scaleBreakdown(lines, 1850, to);
      expect(out.reduce((s, l) => s + l.amount, 0)).toBe(to);
      expect(out.map((l) => l.label)).toEqual(['Materials', 'Time', 'Packaging']);
    }
    expect(scaleBreakdown([], 0, 700)).toEqual([{ label: 'Agreed price', amount: 700 }]);
  });
});

describe('quote validity and counters', () => {
  const now = new Date('2026-09-21T10:00:00Z');
  it('only an open (SENT) quote past validUntil is expired', () => {
    expect(isQuoteExpired({ status: 'SENT', validUntil: new Date('2026-09-21T09:59:59Z') }, now)).toBe(true);
    expect(isQuoteExpired({ status: 'SENT', validUntil: new Date('2026-09-21T10:00:01Z') }, now)).toBe(false);
    expect(isQuoteExpired({ status: 'ACCEPTED', validUntil: new Date('2020-01-01') }, now)).toBe(false);
    expect(isQuoteExpired({ status: 'COUNTERED', validUntil: new Date('2020-01-01') }, now)).toBe(false);
  });

  it('adds whole days', () => {
    expect(addDays(now, 7).toISOString()).toBe('2026-09-28T10:00:00.000Z');
  });

  it('allows at most two counters', () => {
    expect(MAX_COUNTERS).toBe(2);
    expect([0, 1, 2, 3].map(countersRemaining)).toEqual([2, 1, 0, 0]);
  });

  it('flags a change request as extra-charge once the included revisions are used up', () => {
    // quote includes 1 revision: first change is free, second is chargeable
    expect(revisionExceeded(0, 1)).toBe(false);
    expect(revisionExceeded(1, 1)).toBe(true);
    // a quote with 0 included revisions charges from the first
    expect(revisionExceeded(0, 0)).toBe(true);
    expect(revisionExceeded(2, 3)).toBe(false);
  });
});
