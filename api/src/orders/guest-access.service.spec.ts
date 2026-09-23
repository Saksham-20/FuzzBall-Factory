import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import type { Env } from '../config/env.js';
import { GUEST_ORDERS_COOKIE, GuestAccessService } from './guest-access.service.js';

const config = (secret = 'a'.repeat(40)) => ({ get: (k: string) => (k === 'JWT_ACCESS_SECRET' ? secret : k === 'NODE_ENV' ? 'test' : undefined) }) as unknown as ConfigService<Env, true>;
const jwt = new JwtService({});

function cookieOf(res: { cookie: ReturnType<typeof vi.fn> }) {
  const call = res.cookie.mock.calls[0] as [string, string, Record<string, unknown>];
  return { name: call[0], value: call[1], options: call[2] };
}
const reqWith = (value?: string) => ({ cookies: value ? { [GUEST_ORDERS_COOKIE]: value } : {} }) as unknown as Request;

describe('GuestAccessService', () => {
  const svc = new GuestAccessService(jwt, config());

  it('grants access to the order just placed and reads it back', () => {
    const res = { cookie: vi.fn() };
    svc.grant(reqWith(), res as unknown as Response, 'FB-1001');
    const c = cookieOf(res);
    expect(c.name).toBe('fbf_go');
    expect(c.options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/orders' });
    expect(svc.read(reqWith(c.value))).toEqual(['FB-1001']);
  });

  it('accumulates orders placed from the same browser', () => {
    const first = { cookie: vi.fn() };
    svc.grant(reqWith(), first as unknown as Response, 'FB-1001');
    const second = { cookie: vi.fn() };
    svc.grant(reqWith(cookieOf(first).value), second as unknown as Response, 'FB-1002');
    expect(svc.read(reqWith(cookieOf(second).value)).sort()).toEqual(['FB-1001', 'FB-1002']);
  });

  it('rejects tampered, foreign-secret, missing and garbage cookies', () => {
    const res = { cookie: vi.fn() };
    svc.grant(reqWith(), res as unknown as Response, 'FB-1001');
    const good = cookieOf(res).value;
    const [h, p, s] = good.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ typ: 'guest-orders', nums: ['FB-1001', 'FB-2000'] })).toString('base64url');
    expect(svc.read(reqWith(`${h}.${forgedPayload}.${s}`))).toEqual([]);
    expect(svc.read(reqWith(`${h}.${p}.${s.slice(0, -2)}xx`))).toEqual([]);
    expect(new GuestAccessService(jwt, config('b'.repeat(40))).read(reqWith(good))).toEqual([]);
    expect(svc.read(reqWith())).toEqual([]);
    expect(svc.read(reqWith('not.a.jwt'))).toEqual([]);
  });

  it('an access token can never be replayed as a guest cookie (different key, different purpose)', () => {
    const access = jwt.sign({ sub: 'u1', role: 'admin', tv: 0 }, { secret: 'a'.repeat(40) });
    expect(svc.read(reqWith(access))).toEqual([]);
  });

  it('caps how many orders one cookie remembers', () => {
    let value: string | undefined;
    for (let i = 1; i <= 25; i++) {
      const res = { cookie: vi.fn() };
      svc.grant(reqWith(value), res as unknown as Response, `FB-${1000 + i}`);
      value = cookieOf(res).value;
    }
    const nums = svc.read(reqWith(value));
    expect(nums).toHaveLength(20);
    expect(nums).toContain('FB-1025');
    expect(nums).not.toContain('FB-1001');
  });
});
