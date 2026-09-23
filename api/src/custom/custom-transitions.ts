import type { CustomStatus } from '../generated/prisma/enums.js';

/**
 * The work-order state machine (docs/PLAN.md §5). This table is the ONLY definition of what may follow what;
 * `CustomStateService.transition` refuses everything else (409). Terminal states have no exits, except that an
 * EXPIRED quote can be re-quoted by the maker.
 *
 * REQUESTED → UNDER_REVIEW → QUOTED ⇄ COUNTERED (max 2) → ACCEPTED → DEPOSIT_PENDING → IN_QUEUE → IN_PROGRESS
 *   → AWAITING_APPROVAL → BALANCE_PENDING → READY_TO_SHIP → SHIPPED → DELIVERED → CLOSED
 * exits: DECLINED (maker), CANCELLED (customer), EXPIRED (quote validity)
 */
export const CUSTOM_TRANSITIONS: Record<CustomStatus, readonly CustomStatus[]> = {
  REQUESTED: ['UNDER_REVIEW', 'QUOTED', 'DECLINED', 'CANCELLED'],
  UNDER_REVIEW: ['QUOTED', 'DECLINED', 'CANCELLED'],
  QUOTED: ['COUNTERED', 'ACCEPTED', 'EXPIRED', 'DECLINED', 'CANCELLED'],
  COUNTERED: ['QUOTED', 'ACCEPTED', 'DECLINED', 'CANCELLED'],
  ACCEPTED: ['DEPOSIT_PENDING', 'CANCELLED'],
  DEPOSIT_PENDING: ['IN_QUEUE', 'IN_PROGRESS', 'CANCELLED'],
  IN_QUEUE: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['AWAITING_APPROVAL'],
  AWAITING_APPROVAL: ['BALANCE_PENDING', 'IN_PROGRESS'],
  BALANCE_PENDING: ['READY_TO_SHIP'],
  READY_TO_SHIP: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['CLOSED'],
  CLOSED: [],
  DECLINED: [],
  EXPIRED: ['QUOTED', 'DECLINED', 'CANCELLED'],
  CANCELLED: [],
};

export const canTransition = (from: CustomStatus, to: CustomStatus): boolean => CUSTOM_TRANSITIONS[from].includes(to);

/** Statuses from which the maker may (re)send a quote. */
export const QUOTABLE: readonly CustomStatus[] = ['REQUESTED', 'UNDER_REVIEW', 'COUNTERED', 'EXPIRED'];
/** Statuses from which the maker may decline the request outright. */
export const DECLINABLE: readonly CustomStatus[] = ['REQUESTED', 'UNDER_REVIEW', 'QUOTED', 'COUNTERED', 'EXPIRED'];
