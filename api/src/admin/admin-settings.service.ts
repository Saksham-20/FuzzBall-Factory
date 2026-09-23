import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { SETTING_KEYS, type StoreSettings } from '../settings/settings.types.js';
import type { AdminCtx } from './admin-custom.service.js';
import { AuditService } from './audit.service.js';
import type { SettingsInputDto } from './dto/settings.dto.js';

/** Keys whose value differs, as `{ key: [before, after] }` (for the audit trail). */
export function diffSettings(before: StoreSettings, after: StoreSettings): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  for (const key of SETTING_KEYS) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) out[key] = [before[key], after[key]];
  }
  return out;
}

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  get(): Promise<StoreSettings> {
    return this.settings.getStoreSettings();
  }

  /** Full replace. Every key is validated by the DTO; changes are audited with before/after values. */
  async update(ctx: AdminCtx, dto: SettingsInputDto): Promise<StoreSettings> {
    const next: StoreSettings = {
      whatsapp: dto.whatsapp,
      email: dto.email,
      freeShippingAbove: dto.freeShippingAbove,
      domesticShipping: dto.domesticShipping,
      codEnabled: dto.codEnabled,
      codCap: dto.codCap,
      codFee: dto.codFee,
      giftWrapPrice: dto.giftWrapPrice,
      intlZones: dto.intlZones.map((z) => ({ name: z.name, countries: z.countries, rate: z.rate, days: z.days })),
      depositPct: dto.depositPct,
      quoteValidityDays: dto.quoteValidityDays,
    };
    return this.prisma.$transaction(async (tx) => {
      const before = await this.settings.getStoreSettings(tx);
      for (const key of SETTING_KEYS) {
        const value = next[key] as Prisma.InputJsonValue;
        await tx.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
      }
      const changed = diffSettings(before, next);
      await this.audit.log({ actorId: ctx.actorId, action: 'settings.update', entity: 'Setting', meta: changed as unknown as Prisma.InputJsonValue, ip: ctx.ip }, tx);
      return next;
    });
  }
}
