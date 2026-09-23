import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OrderStatus } from '../generated/prisma/enums.js';
import { allowedNextStatuses, canTransition, CUSTOMER_CANCELLABLE, ORDER_NEXT } from './order-transitions.js';

const ALL = Object.values(OrderStatus);

describe('ORDER_NEXT (order state machine table)', () => {
  it('has an entry for every status', () => {
    expect(Object.keys(ORDER_NEXT).sort()).toEqual([...ALL].sort());
  });

  it.each([
    ['PENDING_PAYMENT', 'CANCELLED'],
    ['PLACED', 'CONFIRMED'],
    ['PLACED', 'CANCELLED'],
    ['CONFIRMED', 'IN_PRODUCTION'],
    ['CONFIRMED', 'PACKED'],
    ['IN_PRODUCTION', 'PACKED'],
    ['PACKED', 'SHIPPED'],
    ['SHIPPED', 'DELIVERED'],
    ['DELIVERED', 'RETURN_REQUESTED'],
    ['RETURN_REQUESTED', 'REFUNDED'],
    ['RETURN_REQUESTED', 'DELIVERED'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['PENDING_PAYMENT', 'CONFIRMED'], // only a captured payment does this, never a click
    ['PENDING_PAYMENT', 'SHIPPED'],
    ['PLACED', 'SHIPPED'],
    ['CONFIRMED', 'DELIVERED'],
    ['PACKED', 'CONFIRMED'],
    ['SHIPPED', 'CANCELLED'],
    ['SHIPPED', 'PACKED'],
    ['DELIVERED', 'CANCELLED'],
    ['DELIVERED', 'REFUNDED'],
    ['CANCELLED', 'PLACED'],
    ['CANCELLED', 'CONFIRMED'],
    ['REFUNDED', 'DELIVERED'],
  ] as const)('forbids %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('cancelled and refunded are terminal', () => {
    expect(allowedNextStatuses('CANCELLED')).toEqual([]);
    expect(allowedNextStatuses('REFUNDED')).toEqual([]);
  });

  it('nothing transitions to itself, and every target is a real status', () => {
    for (const from of ALL) for (const to of ORDER_NEXT[from]) {
      expect(to).not.toBe(from);
      expect(ALL).toContain(to);
    }
  });

  it('customers can only cancel before production starts', () => {
    expect(CUSTOMER_CANCELLABLE).toEqual(['PENDING_PAYMENT', 'PLACED', 'CONFIRMED']);
    for (const s of CUSTOMER_CANCELLABLE) expect(ORDER_NEXT[s]).toContain('CANCELLED');
  });

  it('matches ORDER_NEXT in web/src/lib/api/admin.ts (the admin UI offers exactly these steps)', () => {
    const file = resolve(process.cwd(), '../web/src/lib/api/admin.ts');
    if (!existsSync(file)) return; // api checked out on its own
    const src = readFileSync(file, 'utf8');
    const block = /const ORDER_NEXT[^=]*=\s*\{([\s\S]*?)\n\};/.exec(src)?.[1];
    expect(block).toBeTruthy();
    const web: Record<string, string[]> = {};
    for (const m of block!.matchAll(/(\w+):\s*\[([^\]]*)\]/g)) web[m[1]] = [...m[2].matchAll(/"(\w+)"/g)].map((x) => x[1]);
    expect(ORDER_NEXT).toEqual(web);
  });
});
