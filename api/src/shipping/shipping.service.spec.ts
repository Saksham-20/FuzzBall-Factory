import type { SettingsService } from '../settings/settings.service.js';
import { DEFAULT_SETTINGS, type StoreSettings } from '../settings/settings.types.js';
import { addressFieldErrors } from './address-validation.js';
import type { ShippingProvider } from './shipping.provider.js';
import { ShippingService } from './shipping.service.js';

const NOW = new Date('2026-09-21T06:00:00.000Z'); // Monday
const svc = (settings: StoreSettings = DEFAULT_SETTINGS, provider: ShippingProvider = { check: () => Promise.resolve(null) }) =>
  new ShippingService({ getStoreSettings: () => Promise.resolve(settings) } as unknown as SettingsService, provider);

describe('ShippingService.check', () => {
  it.each(['', '12', '56003', '0560038', '560 038', 'ABCDEF', '056003'])('rejects the invalid Indian pincode "%s"', async (postalCode) => {
    expect(await svc().check({ country: 'IN', postalCode }, NOW)).toEqual({ serviceable: false, message: 'Enter a valid 6-digit pincode.', transitDays: '', codAvailable: false });
  });

  it('serves a valid pincode with lead time + 5 business days', async () => {
    const r = await svc().check({ country: 'IN', postalCode: '560038', leadTimeDays: 3 }, NOW);
    expect(r).toMatchObject({ serviceable: true, message: 'We deliver here.', transitDays: '3–6 days', codAvailable: false });
    expect(r.deliverBy).toBe('2026-09-30T06:00:00.000Z'); // Mon + 8 business days (skipping Sunday 27th) = Wed 30th
  });

  it('COD is available in India only for ready pieces with COD switched on', async () => {
    expect((await svc().check({ country: 'IN', postalCode: '560038', ready: true }, NOW)).codAvailable).toBe(true);
    expect((await svc().check({ country: 'IN', postalCode: '560038', ready: false }, NOW)).codAvailable).toBe(false);
    expect((await svc({ ...DEFAULT_SETTINGS, codEnabled: false }).check({ country: 'IN', postalCode: '560038', ready: true }, NOW)).codAvailable).toBe(false);
  });

  it('international: zone from settings, +12 business days, never COD, any postal code', async () => {
    const r = await svc().check({ country: 'GB', postalCode: '', ready: true }, NOW);
    expect(r).toMatchObject({ serviceable: true, transitDays: '8–14 days', codAvailable: false, message: 'We ship to this country (UK & Europe).' });
    expect(r.deliverBy).toBeTruthy();
    expect((await svc().check({ country: 'ZZ', postalCode: '' }, NOW)).message).toContain('Rest of world');
  });

  it('uses the provider (Shiprocket seam) when it answers, and honours "not serviceable"', async () => {
    const provider: ShippingProvider = { check: () => Promise.resolve({ serviceable: true, transitBusinessDays: 2, transitLabel: '1–2 days' }) };
    const fast = await svc(DEFAULT_SETTINGS, provider).check({ country: 'IN', postalCode: '110001', leadTimeDays: 0 }, NOW);
    expect(fast.transitDays).toBe('1–2 days');
    expect(fast.deliverBy).toBe('2026-09-23T06:00:00.000Z');
    const no: ShippingProvider = { check: () => Promise.resolve({ serviceable: false, message: 'No courier serves this pincode.', transitBusinessDays: 0, transitLabel: '' }) };
    expect(await svc(DEFAULT_SETTINGS, no).check({ country: 'IN', postalCode: '110001' }, NOW)).toMatchObject({ serviceable: false, message: 'No courier serves this pincode.' });
  });
});

describe('addressFieldErrors', () => {
  it('Indian addresses need a valid pincode and a known state', () => {
    expect(addressFieldErrors({ country: 'IN', postalCode: '12', state: 'Nowhere' })).toEqual({ postalCode: 'Enter a valid 6-digit pincode.', state: 'Pick your state.' });
    expect(addressFieldErrors({ country: 'IN', postalCode: '560038', state: 'Karnataka' })).toEqual({});
  });
  it('other countries need only a postal code of 3+ characters; prefix is applied', () => {
    expect(addressFieldErrors({ country: 'GB', postalCode: 'N1', state: '' }, 'address.')).toEqual({ 'address.postalCode': 'Enter your postal code.' });
    expect(addressFieldErrors({ country: 'GB', postalCode: 'N10 2LE', state: 'England' })).toEqual({});
  });
});
