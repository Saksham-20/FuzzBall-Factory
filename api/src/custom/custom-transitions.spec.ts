import { CUSTOM_TRANSITIONS, canTransition, DECLINABLE, QUOTABLE } from './custom-transitions.js';
import type { CustomStatus } from '../generated/prisma/enums.js';

const ALL = Object.keys(CUSTOM_TRANSITIONS) as CustomStatus[];

describe('custom work-order transition table', () => {
  it('defines every status and only points at real statuses', () => {
    expect(ALL).toHaveLength(17);
    for (const [from, tos] of Object.entries(CUSTOM_TRANSITIONS)) {
      for (const to of tos) expect(ALL, `${from} -> ${to}`).toContain(to);
      expect(tos).not.toContain(from);
      expect(new Set(tos).size).toBe(tos.length);
    }
  });

  it('allows the whole happy path, hop by hop', () => {
    const path: CustomStatus[] = [
      'REQUESTED', 'UNDER_REVIEW', 'QUOTED', 'COUNTERED', 'QUOTED', 'ACCEPTED', 'DEPOSIT_PENDING', 'IN_PROGRESS',
      'AWAITING_APPROVAL', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'BALANCE_PENDING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CLOSED',
    ];
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1]), `${path[i]} -> ${path[i + 1]}`).toBe(true);
  });

  it('allows the counter-accepted shortcut and the paid-into-queue variant', () => {
    expect(canTransition('COUNTERED', 'ACCEPTED')).toBe(true);
    expect(canTransition('DEPOSIT_PENDING', 'IN_QUEUE')).toBe(true);
    expect(canTransition('IN_QUEUE', 'IN_PROGRESS')).toBe(true);
  });

  it.each<[CustomStatus, CustomStatus]>([
    ['REQUESTED', 'ACCEPTED'],
    ['REQUESTED', 'IN_PROGRESS'],
    ['QUOTED', 'DEPOSIT_PENDING'], // must pass through ACCEPTED
    ['QUOTED', 'IN_PROGRESS'],
    ['ACCEPTED', 'IN_PROGRESS'], // deposit has to be paid first
    ['DEPOSIT_PENDING', 'READY_TO_SHIP'],
    ['IN_PROGRESS', 'BALANCE_PENDING'], // approval comes first
    ['IN_PROGRESS', 'SHIPPED'],
    ['AWAITING_APPROVAL', 'READY_TO_SHIP'], // balance first
    ['BALANCE_PENDING', 'SHIPPED'],
    ['READY_TO_SHIP', 'DELIVERED'],
    ['SHIPPED', 'IN_PROGRESS'],
    ['DELIVERED', 'SHIPPED'],
    ['IN_PROGRESS', 'CANCELLED'], // non-refundable once work has started
    ['BALANCE_PENDING', 'CANCELLED'],
  ])('refuses %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('has no way out of the terminal states (except re-quoting an expired quote)', () => {
    for (const s of ['CLOSED', 'DECLINED', 'CANCELLED'] as const) expect(CUSTOM_TRANSITIONS[s]).toEqual([]);
    expect(CUSTOM_TRANSITIONS.EXPIRED).toEqual(['QUOTED', 'DECLINED', 'CANCELLED']);
  });

  it('QUOTABLE / DECLINABLE only list statuses the table lets the maker act from', () => {
    for (const s of QUOTABLE) expect(canTransition(s, 'QUOTED'), s).toBe(true);
    for (const s of DECLINABLE) expect(canTransition(s, 'DECLINED'), s).toBe(true);
  });
});
