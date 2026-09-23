import { hashRequest, stableStringify } from './idempotency/idempotency.service.js';
import { formatOrderNumber, formatWorkOrderNumber } from './numbering.service.js';
import { normalizePhone } from './phone.js';
import { renderTemplate, templates } from '../notifications/templates/registry.js';
import type { NotificationEvent } from '../notifications/events.js';

describe('idempotency request hashing', () => {
  it('ignores key order and undefined values', () => {
    expect(hashRequest({ a: 1, b: { c: 2, d: [1, 2] } })).toBe(hashRequest({ b: { d: [1, 2], c: 2 }, a: 1, z: undefined }));
  });
  it('differs when the body differs', () => {
    expect(hashRequest({ qty: 1 })).not.toBe(hashRequest({ qty: 2 }));
    expect(stableStringify([1, { b: 1, a: 2 }])).toBe('[1,{"a":2,"b":1}]');
  });
});

describe('numbers', () => {
  it('formats order and work-order numbers', () => {
    expect(formatOrderNumber(1001)).toBe('FB-1001');
    expect(formatWorkOrderNumber(7)).toBe('WO-007');
    expect(formatWorkOrderNumber(1234)).toBe('WO-1234');
  });
});

describe('normalizePhone', () => {
  it.each([
    ['9800000001', '+919800000001'],
    ['+91 98000-00001', '+919800000001'],
    ['09800000001', '+919800000001'],
    ['+44 7700 900123', '+447700900123'],
    ['0044 7700 900123', '+447700900123'],
    ['919800000001', '+919800000001'],
  ])('%s -> %s', (input, expected) => expect(normalizePhone(input)).toBe(expected));
  it('rejects implausible numbers', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
});

describe('email templates', () => {
  const ctx = { brandName: 'FuzzBall Factory', supportEmail: 'hello@example.com' };
  it('has a template for every event and renders html + text', () => {
    const order = { to: 'a@b.co', name: 'Maya Iyer', orderNumber: 'FB-1001', url: 'http://x/o', total: 1450 };
    const wo = { to: 'a@b.co', name: 'Maya Iyer', workOrderNumber: 'WO-001', title: 'Panda', url: 'http://x/w', amount: 1850 };
    for (const event of Object.keys(templates) as NotificationEvent[]) {
      const payload = event.startsWith('order.') ? order : event.startsWith('workorder.') ? wo : { ...order, resetUrl: 'http://x/r', expiresInMinutes: 60 };
      const r = renderTemplate(event, payload as never, ctx);
      expect(r.subject.length).toBeGreaterThan(3);
      expect(r.html).toContain('<!doctype html>');
      expect(r.text.length).toBeGreaterThan(10);
      expect(r.subject).not.toContain('{n}');
    }
  });
  it('escapes user-controlled text in html', () => {
    const r = renderTemplate('workorder.received', { to: 'a@b.co', name: 'X', workOrderNumber: 'WO-001', title: '<script>alert(1)</script>', url: 'http://x' }, ctx);
    expect(r.html).not.toContain('<script>');
    expect(r.html).toContain('&lt;script&gt;');
  });
  it('password reset carries the link and expiry', () => {
    const r = renderTemplate('auth.password_reset', { to: 'a@b.co', name: 'Maya', resetUrl: 'http://x/reset?token=abc', expiresInMinutes: 60 }, ctx);
    expect(r.text).toContain('http://x/reset?token=abc');
    expect(r.text).toContain('60 minutes');
  });
});
