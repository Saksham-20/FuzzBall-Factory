import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { OptionalAuth } from '../common/decorators/public.decorator.js';
import type { RequestUser } from '../common/types/auth.types.js';
import { QuoteDto, ValidateCouponDto } from './dto/quote.dto.js';
import type { CheckoutQuote } from './pricing.types.js';
import { PricingService, type CouponCheck } from './pricing.service.js';

@Controller()
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  /** Server-computed totals. Guests allowed (a signed-in user additionally gets per-user coupon limits applied). */
  @OptionalAuth()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(200)
  @Post('checkout/quote')
  quote(@Body() dto: QuoteDto, @CurrentUser() user: RequestUser | undefined): Promise<CheckoutQuote> {
    return this.pricing.quote(dto.lines, { country: dto.country, giftWrap: dto.giftWrap, coupon: dto.coupon, paymentMethod: dto.paymentMethod }, user?.userId);
  }

  @OptionalAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('coupons/validate')
  validate(@Body() dto: ValidateCouponDto, @CurrentUser() user: RequestUser | undefined): Promise<CouponCheck> {
    return this.pricing.checkCoupon(dto.code, dto.lines, user?.userId);
  }
}
