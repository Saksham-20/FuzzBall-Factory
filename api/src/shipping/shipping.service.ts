import { Inject, Injectable } from '@nestjs/common';
import { addBusinessDays } from '../pricing/business-days.js';
import { zoneFor } from '../pricing/pricing.engine.js';
import { SettingsService } from '../settings/settings.service.js';
import { INDIA_PINCODE } from './shipping.constants.js';
import { SHIPPING_PROVIDER, type ShippingProvider } from './shipping.provider.js';

/** Wire shape: web `ShippingCheck` (web/src/lib/api/shipping.ts). */
export interface ShippingCheck {
  serviceable: boolean;
  message: string;
  transitDays: string;
  /** ISO date estimate for delivery, including the product's lead time. */
  deliverBy?: string;
  codAvailable: boolean;
}

const DEFAULT_DOMESTIC_TRANSIT_DAYS = 5;
const DEFAULT_DOMESTIC_LABEL = '3–6 days';
const DEFAULT_INTL_TRANSIT_DAYS = 12;

@Injectable()
export class ShippingService {
  constructor(
    private readonly settings: SettingsService,
    @Inject(SHIPPING_PROVIDER) private readonly provider: ShippingProvider,
  ) {}

  async check(input: { country: string; postalCode: string; leadTimeDays?: number; ready?: boolean }, now: Date = new Date()): Promise<ShippingCheck> {
    const s = await this.settings.getStoreSettings();
    const lead = input.leadTimeDays ?? 2;

    if (input.country === 'IN') {
      if (!INDIA_PINCODE.test(input.postalCode.trim())) {
        return { serviceable: false, message: 'Enter a valid 6-digit pincode.', transitDays: '', codAvailable: false };
      }
      const fromProvider = await this.provider.check({ country: 'IN', postalCode: input.postalCode.trim(), ready: input.ready });
      if (fromProvider && !fromProvider.serviceable) {
        return { serviceable: false, message: fromProvider.message ?? "We can't deliver to this pincode yet.", transitDays: '', codAvailable: false };
      }
      const transit = fromProvider?.transitBusinessDays ?? DEFAULT_DOMESTIC_TRANSIT_DAYS;
      return {
        serviceable: true,
        message: 'We deliver here.',
        transitDays: fromProvider?.transitLabel ?? DEFAULT_DOMESTIC_LABEL,
        deliverBy: addBusinessDays(now, lead + transit).toISOString(),
        codAvailable: !!input.ready && s.codEnabled,
      };
    }

    const zone = zoneFor(input.country, s);
    return {
      serviceable: true,
      message: `We ship to this country (${zone?.name ?? 'international'}).`,
      transitDays: zone?.days ?? '',
      deliverBy: addBusinessDays(now, lead + DEFAULT_INTL_TRANSIT_DAYS).toISOString(),
      codAvailable: false,
    };
  }
}
