import type { OrderRow } from './order.mapper.js';
import { toOrderDto } from './order.mapper.js';

const row = (over: Partial<OrderRow> = {}): OrderRow =>
  ({
    id: 'o1', number: 'FB-1001', userId: null,
    contact: { name: 'Maya', email: 'm@x.com', phone: '+919800000001' },
    contactEmail: 'm@x.com', contactPhone: '+919800000001',
    address: { name: 'Maya', phone: '+919800000001', line1: '1 Road', city: 'Blr', state: 'Karnataka', postalCode: '560038', country: 'IN' },
    subtotal: 498, shipping: 79, codFee: 0, giftWrap: 0, discount: 0, total: 577, currency: 'INR',
    paymentMethod: 'RAZORPAY', paymentStatus: 'PENDING', status: 'PENDING_PAYMENT',
    giftNote: null, hidePrices: false, couponCode: null, courier: null, awb: null, trackingUrl: null, notes: 'admin only', cancelReason: 'private',
    estimatedDispatch: new Date('2026-09-23T06:00:00Z'), createdAt: new Date('2026-09-21T06:00:00Z'), updatedAt: new Date(),
    items: [{ id: 'i1', orderId: 'o1', productId: 'p1', variantId: 'v1', name: 'Mug Rug', image: '/a.jpg', colour: 'Peach', size: null, qty: 2, unitPrice: 249, fulfilment: 'READY', personalization: null }],
    events: [{ id: 'e1', orderId: 'o1', status: 'PENDING_PAYMENT', note: null, photo: null, actorId: null, at: new Date('2026-09-21T06:00:00Z') }],
    ...over,
  }) as OrderRow;

describe('toOrderDto', () => {
  it('matches the web Order shape: rupee ints, ISO dates, optional fields omitted (never null)', () => {
    const dto = toOrderDto(row());
    expect(dto).toEqual({
      number: 'FB-1001',
      contact: { name: 'Maya', email: 'm@x.com', phone: '+919800000001' },
      address: { name: 'Maya', phone: '+919800000001', line1: '1 Road', city: 'Blr', state: 'Karnataka', postalCode: '560038', country: 'IN' },
      items: [{ productId: 'p1', name: 'Mug Rug', image: '/a.jpg', colour: 'Peach', qty: 2, unitPrice: 249, fulfilment: 'READY' }],
      subtotal: 498, shipping: 79, codFee: 0, giftWrap: 0, discount: 0, total: 577, currency: 'INR',
      paymentMethod: 'RAZORPAY', paymentStatus: 'PENDING', status: 'PENDING_PAYMENT',
      estimatedDispatch: '2026-09-23T06:00:00.000Z',
      events: [{ status: 'PENDING_PAYMENT', at: '2026-09-21T06:00:00.000Z' }],
      createdAt: '2026-09-21T06:00:00.000Z',
    });
  });

  it('never leaks admin-only or internal columns', () => {
    const json = JSON.stringify(toOrderDto(row()));
    for (const secret of ['admin only', 'private', 'contactEmail', 'contactPhone', 'hidePrices', 'couponCode', 'trackingUrl', '"id"']) expect(json).not.toContain(secret);
  });

  it('includes optional fields when present', () => {
    const dto = toOrderDto(row({ userId: 'u1', giftNote: 'Happy birthday', courier: 'Delhivery', awb: 'DL1', address: { name: 'M', phone: '1', line1: 'a', line2: 'b', city: 'c', state: 's', postalCode: '1', country: 'IN' } } as Partial<OrderRow>));
    expect(dto).toMatchObject({ userId: 'u1', giftNote: 'Happy birthday', courier: 'Delhivery', awb: 'DL1' });
    expect(dto.address.line2).toBe('b');
  });

  it('survives a deleted product (productId null) and tolerates odd JSON snapshots', () => {
    const dto = toOrderDto(row({ contact: null, items: [{ ...row().items[0], productId: null, size: 'M', personalization: 'Priya' }] } as unknown as Partial<OrderRow>));
    expect(dto.items[0]).toMatchObject({ productId: '', size: 'M', personalization: 'Priya' });
    expect(dto.contact).toEqual({ name: '', email: '', phone: '' });
  });
});
