import { ACK_HOURS, CATEGORIES, dueDates, formatTicketNumber, RESOLVE_DAYS, slaOf, statusAfterCustomerMessage, statusAfterMakerReply } from './support.rules.js';

const t0 = new Date('2026-10-01T10:00:00Z');
const ticket = (over: Partial<Parameters<typeof slaOf>[0]> = {}) => ({
  status: 'OPEN' as const,
  kind: 'GRIEVANCE' as const,
  ...dueDates('GRIEVANCE', t0),
  ackedAt: null,
  resolvedAt: null,
  ...over,
});

describe('support rules', () => {
  it('numbers by kind with four digits', () => {
    expect(formatTicketNumber('SUPPORT', 7)).toBe('SUP-0007');
    expect(formatTicketNumber('GRIEVANCE', 123)).toBe('GRV-0123');
    expect(formatTicketNumber('IP_NOTICE', 1)).toBe('IPN-0001');
    expect(formatTicketNumber('DATA_REQUEST', 12345)).toBe('DSR-12345');
  });

  it('gives every kind a category list', () => {
    for (const kind of Object.keys(RESOLVE_DAYS) as (keyof typeof CATEGORIES)[]) expect(CATEGORIES[kind].length).toBeGreaterThan(0);
  });

  it('computes the 48 hour acknowledgement and per-kind resolution dates', () => {
    const d = dueDates('GRIEVANCE', t0);
    expect(d.ackDueAt.getTime() - t0.getTime()).toBe(ACK_HOURS * 3_600_000);
    expect(d.resolveDueAt.getTime() - t0.getTime()).toBe(30 * 86_400_000);
    expect(dueDates('SUPPORT', t0).resolveDueAt.getTime() - t0.getTime()).toBe(7 * 86_400_000);
  });

  it('walks a ticket through ok, due-soon and overdue on both clocks', () => {
    const at = (ms: number) => new Date(t0.getTime() + ms);
    const h = 3_600_000;
    expect(slaOf(ticket(), at(h))).toMatchObject({ ack: 'ok', resolve: 'ok' });
    expect(slaOf(ticket(), at(40 * h))).toMatchObject({ ack: 'due-soon' });
    expect(slaOf(ticket(), at(49 * h))).toMatchObject({ ack: 'overdue' });
    expect(slaOf(ticket(), at(26 * 24 * h))).toMatchObject({ resolve: 'due-soon' });
    expect(slaOf(ticket(), at(31 * 24 * h))).toMatchObject({ resolve: 'overdue' });
  });

  it('stops the clocks once acknowledged and resolved', () => {
    const late = new Date(t0.getTime() + 90 * 86_400_000);
    expect(slaOf(ticket({ ackedAt: t0, status: 'RESOLVED', resolvedAt: t0 }), late)).toMatchObject({ ack: 'done', resolve: 'done' });
    expect(slaOf(ticket({ status: 'CLOSED' }), late).resolve).toBe('done');
  });

  it('uses a shorter reminder window for a 7 day target', () => {
    const support = { status: 'OPEN' as const, kind: 'SUPPORT' as const, ...dueDates('SUPPORT', t0), ackedAt: t0, resolvedAt: null };
    expect(slaOf(support, new Date(t0.getTime() + 3 * 86_400_000)).resolve).toBe('ok');
    expect(slaOf(support, new Date(t0.getTime() + 5 * 86_400_000)).resolve).toBe('due-soon');
  });

  it('reopens on a customer message, except when closed; a maker reply hands the turn over', () => {
    expect(statusAfterCustomerMessage('WAITING_CUSTOMER')).toBe('OPEN');
    expect(statusAfterCustomerMessage('RESOLVED')).toBe('OPEN');
    expect(statusAfterCustomerMessage('CLOSED')).toBeNull();
    expect(statusAfterMakerReply('OPEN')).toBe('WAITING_CUSTOMER');
    expect(statusAfterMakerReply('RESOLVED')).toBe('RESOLVED');
  });
});
