import { checkCoupon } from './admin-coupons.service.js';
import { diffSettings } from './admin-settings.service.js';
import { DEFAULT_SETTINGS } from '../settings/settings.types.js';

describe('coupon rules', () => {
  it('a percent coupon cannot exceed 100', () => {
    expect(checkCoupon({ kind: 'PERCENT', value: 120 })).toHaveProperty('value');
    expect(checkCoupon({ kind: 'PERCENT', value: 100 })).toEqual({});
    expect(checkCoupon({ kind: 'FLAT', value: 500 })).toEqual({});
  });
  it('expiry must be a real date', () => {
    expect(checkCoupon({ kind: 'FLAT', value: 5, expiresAt: 'not-a-date' })).toHaveProperty('expiresAt');
    expect(checkCoupon({ kind: 'FLAT', value: 5, expiresAt: '2026-12-31' })).toEqual({});
  });
});

describe('settings audit diff', () => {
  it('lists only the keys that changed, with before and after', () => {
    const after = { ...DEFAULT_SETTINGS, depositPct: 40, intlZones: [...DEFAULT_SETTINGS.intlZones] };
    expect(diffSettings(DEFAULT_SETTINGS, after)).toEqual({ depositPct: [50, 40] });
    expect(diffSettings(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS })).toEqual({});
  });
});
