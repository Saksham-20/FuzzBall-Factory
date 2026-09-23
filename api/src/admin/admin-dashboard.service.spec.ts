import { bucketRevenue, daysSinceOldest, istDay, istMidnight, lastDays, workshopSummary } from './admin-dashboard.service.js';

describe('dashboard day maths (IST)', () => {
  it('the store day rolls over at midnight IST, not UTC', () => {
    // 21:00 UTC on the 20th is 02:30 IST on the 21st
    expect(istDay(new Date('2026-09-20T21:00:00Z'))).toBe('2026-09-21');
    expect(istDay(new Date('2026-09-20T18:29:59Z'))).toBe('2026-09-20');
    expect(istDay(new Date('2026-09-20T18:30:00Z'))).toBe('2026-09-21');
  });

  it('builds 30 consecutive days ending today, across a month boundary', () => {
    const days = lastDays(new Date('2026-10-03T08:00:00Z'), 30);
    expect(days).toHaveLength(30);
    expect(days[29]).toBe('2026-10-03');
    expect(days[0]).toBe('2026-09-04');
    expect(new Set(days).size).toBe(30);
    expect(days).toEqual([...days].sort());
  });

  it('istMidnight is 18:30 UTC of the previous day', () => {
    expect(istMidnight('2026-09-21').toISOString()).toBe('2026-09-20T18:30:00.000Z');
  });
});

describe('revenue buckets', () => {
  const now = new Date('2026-09-21T10:00:00Z');
  const days = lastDays(now, 30);

  it('fills empty days with 0 and keeps oldest first', () => {
    const { revenueByDay } = bucketRevenue(days, [{ day: '2026-09-21', amount: 1450 }, { day: '2026-09-10', amount: 399 }]);
    expect(revenueByDay).toHaveLength(30);
    expect(revenueByDay[29]).toEqual({ date: '2026-09-20T18:30:00.000Z', amount: 1450 });
    expect(revenueByDay.filter((d) => d.amount === 0)).toHaveLength(28);
    const dates = revenueByDay.map((d) => d.date);
    expect(dates).toEqual(dates.toSorted());
  });

  it('today, 7-day and 30-day totals come from the same buckets', () => {
    const rows = [
      { day: '2026-09-21', amount: 1000 }, // today
      { day: '2026-09-15', amount: 200 }, // 6 days ago: still inside the 7-day window
      { day: '2026-09-14', amount: 300 }, // 7 days ago: outside it
      { day: '2026-08-23', amount: 50 }, // oldest day of the window
      { day: '2026-08-22', amount: 9999 }, // outside every window: never bucketed
    ];
    const { revenue, revenueByDay } = bucketRevenue(days, rows);
    expect(revenue).toEqual({ today: 1000, d7: 1200, d30: 1550 });
    expect(revenue.d30).toBe(revenueByDay.reduce((s, d) => s + d.amount, 0));
  });

  it('is all zeros with no orders (no invented numbers)', () => {
    expect(bucketRevenue(days, []).revenue).toEqual({ today: 0, d7: 0, d30: 0 });
  });
});

describe('workshop load', () => {
  const now = new Date('2026-09-22T10:00:00Z');

  it('daysSinceOldest is null with nothing in progress', () => {
    expect(daysSinceOldest(now, [])).toBeNull();
  });

  it('daysSinceOldest picks the single oldest start, not the newest or an average', () => {
    const starts = [new Date('2026-09-20T10:00:00Z'), new Date('2026-09-13T10:00:00Z'), new Date('2026-09-21T10:00:00Z')];
    expect(daysSinceOldest(now, starts)).toBe(9);
  });

  it('workshopSummary reports nothing in progress honestly, with no counts', () => {
    expect(workshopSummary(0, 0, null)).toBe('Nothing in the workshop right now.');
  });

  it('workshopSummary states the total pieces and the oldest age in plain language', () => {
    expect(workshopSummary(4, 2, 9)).toBe('6 pieces in progress, oldest started 9 days ago.');
    expect(workshopSummary(1, 0, 1)).toBe('1 piece in progress, oldest started 1 day ago.');
    expect(workshopSummary(1, 0, 0)).toBe('1 piece in progress, oldest started today.');
  });
});
