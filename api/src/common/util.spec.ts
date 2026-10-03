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
    const ticket = { to: 'a@b.co', name: 'Maya Iyer', ticketNumber: 'SUP-0001', subject: 'Message: general', url: 'http://x/t', message: 'Hello there, a question', fromEmail: 'visitor@b.co', kind: 'SUPPORT', isReply: false, items: [{ ticketNumber: 'GRV-0001', subject: 's', url: 'http://x', what: 'acknowledge within 5 hours' }] };
    for (const event of Object.keys(templates) as NotificationEvent[]) {
      const payload = event.startsWith('order.') ? order : event.startsWith('workorder.') ? wo : event.startsWith('ticket.') ? ticket : { ...order, resetUrl: 'http://x/r', verifyUrl: 'http://x/v', confirmUrl: 'http://x/c', newEmail: 'new@b.co', expiresInMinutes: 60, fromEmail: 'visitor@b.co', message: 'Do you make blue bunnies?' };
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
  it('a new-ticket notice replies to the sender and escapes their text', () => {
    const r = renderTemplate('ticket.new_admin', { to: 'maker@b.co', name: 'Mo\n<b>', fromEmail: 'visitor@b.co', message: '<img src=x onerror=alert(1)>', ticketNumber: 'SUP-0001', subject: 'Message: general\n(order)', url: 'http://x/admin/support/1', kind: 'SUPPORT', isReply: false }, ctx);
    expect(r.replyTo).toBe('visitor@b.co');
    expect(r.subject).not.toContain('\n');
    expect(r.html).not.toContain('<img');
    expect(r.html).toContain('&lt;img');
    const noEmail = renderTemplate('ticket.new_admin', { to: 'maker@b.co', name: 'Walk-in', message: 'hello', ticketNumber: 'SUP-0002', subject: 's', url: 'http://x', kind: 'SUPPORT', isReply: true }, ctx);
    expect(noEmail.replyTo).toBeUndefined();
    expect(noEmail.text).toContain('no email given');
  });
  it('the receipt carries the reference and a copy of the complaint; a grievance adds the one-month promise', () => {
    const base = { to: 'a@b.co', name: 'Maya Iyer', ticketNumber: 'GRV-0004', subject: 'Complaint: refund', url: 'http://x/support/ticket/GRV-0004?t=abc', message: 'My refund has not arrived', resolveBy: '2 November 2026' };
    const plain = renderTemplate('ticket.received', base, ctx);
    expect(plain.subject).toContain('GRV-0004');
    expect(plain.text).toContain('My refund has not arrived');
    expect(plain.text).not.toContain('recorded as a complaint');
    const grievance = renderTemplate('ticket.received', { ...base, grievance: true }, ctx);
    expect(grievance.text).toContain('recorded as a complaint');
    expect(grievance.text).toContain('2 November 2026');
  });
  it('a resolved grievance points to the National Consumer Helpline', () => {
    const r = renderTemplate('ticket.resolved', { to: 'a@b.co', name: 'Maya', ticketNumber: 'GRV-0004', subject: 's', url: 'http://x', message: 'Refunded in full', grievance: true }, ctx);
    expect(r.text).toContain('1915');
    expect(renderTemplate('ticket.resolved', { to: 'a@b.co', name: 'Maya', ticketNumber: 'SUP-0004', subject: 's', url: 'http://x' }, ctx).text).not.toContain('1915');
  });
  it('overseas orders get the customs reminder, domestic ones do not', () => {
    const base = { to: 'a@b.co', name: 'Maya', orderNumber: 'FB-1001', url: 'http://x/o', total: 1900 };
    for (const event of ['order.confirmed', 'order.shipped'] as const) {
      expect(renderTemplate(event, { ...base, international: true }, ctx).text).toMatch(/duties/i);
      expect(renderTemplate(event, base, ctx).text).not.toMatch(/duties/i);
    }
  });
});
