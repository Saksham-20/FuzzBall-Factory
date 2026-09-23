import { mergeSettings } from './settings.service.js';
import { DEFAULT_SETTINGS } from './settings.types.js';

describe('mergeSettings', () => {
  it('returns the defaults for an empty table', () => {
    expect(mergeSettings([])).toEqual(DEFAULT_SETTINGS);
  });

  it('applies stored values of the right type', () => {
    const s = mergeSettings([
      { key: 'domesticShipping', value: 99 },
      { key: 'codEnabled', value: false },
      { key: 'whatsapp', value: '919999999999' },
    ]);
    expect(s).toMatchObject({ domesticShipping: 99, codEnabled: false, whatsapp: '919999999999', codCap: DEFAULT_SETTINGS.codCap });
  });

  it('ignores corrupt values and unknown keys (a bad admin edit must not break checkout)', () => {
    const s = mergeSettings([
      { key: 'domesticShipping', value: '79' },
      { key: 'codCap', value: -5 },
      { key: 'depositPct', value: 150 },
      { key: 'intlZones', value: [] },
      { key: 'intlZones', value: [{ name: 'x' }] },
      { key: 'secretAdminThing', value: 'nope' },
    ]);
    expect(s).toEqual(DEFAULT_SETTINGS);
    expect(s).not.toHaveProperty('secretAdminThing');
  });

  it('does not share mutable state with the defaults', () => {
    const s = mergeSettings([]);
    s.intlZones[0].rate = 1;
    expect(DEFAULT_SETTINGS.intlZones[0].rate).toBe(899);
  });
});
