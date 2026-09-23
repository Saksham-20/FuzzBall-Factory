import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator.js';
import { ShippingCheckQueryDto } from './dto/shipping-check.dto.js';
import { ShippingService, type ShippingCheck } from './shipping.service.js';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('check')
  check(@Query() q: ShippingCheckQueryDto): Promise<ShippingCheck> {
    return this.shipping.check({ country: q.country, postalCode: q.postalCode, leadTimeDays: q.leadTimeDays, ready: q.ready });
  }
}
