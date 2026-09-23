import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { DEFAULT_SETTINGS, SETTING_KEYS, type IntlZone, type StoreSettings } from './settings.types.js';

type Db = PrismaService | Prisma.TransactionClient;

const isNonNegInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isString = (v: unknown): v is string => typeof v === 'string';
const isZone = (z: unknown): z is IntlZone => {
  const o = z as Partial<IntlZone> | null;
  return !!o && isString(o.name) && isString(o.days) && isNonNegInt(o.rate) && Array.isArray(o.countries) && o.countries.every(isString);
};

/** Per-key validators: a corrupt or missing stored value falls back to the default instead of breaking checkout. */
const VALID: { [K in keyof StoreSettings]: (v: unknown) => v is StoreSettings[K] } = {
  whatsapp: isString,
  email: isString,
  freeShippingAbove: isNonNegInt,
  domesticShipping: isNonNegInt,
  codEnabled: (v): v is boolean => typeof v === 'boolean',
  codCap: isNonNegInt,
  codFee: isNonNegInt,
  giftWrapPrice: isNonNegInt,
  depositPct: (v): v is number => isNonNegInt(v) && v <= 100,
  quoteValidityDays: isNonNegInt,
  intlZones: (v): v is IntlZone[] => Array.isArray(v) && v.length > 0 && v.every(isZone),
};

/** Merge stored rows over the defaults. Pure so it can be unit-tested. */
export function mergeSettings(rows: { key: string; value: unknown }[]): StoreSettings {
  const out: StoreSettings = structuredClone(DEFAULT_SETTINGS);
  const target = out as unknown as Record<string, unknown>;
  for (const row of rows) {
    const key = row.key as keyof StoreSettings;
    if (SETTING_KEYS.includes(key) && (VALID[key] as (v: unknown) => boolean)(row.value)) target[key] = row.value;
  }
  return out;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The public store settings (only the StoreSettings keys are ever read or returned). */
  async getStoreSettings(db: Db = this.prisma): Promise<StoreSettings> {
    const rows = await db.setting.findMany({ where: { key: { in: SETTING_KEYS } } });
    return mergeSettings(rows);
  }
}
