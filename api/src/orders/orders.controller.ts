import { Body, Controller, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { IdempotencyKeyHeader } from '../common/decorators/idempotency-key.decorator.js';
import { OptionalAuth, Public } from '../common/decorators/public.decorator.js';
import { IdempotencyService } from '../common/idempotency/idempotency.service.js';
import type { RequestUser } from '../common/types/auth.types.js';
import type { CheckoutPayment } from '../payments/payments.types.js';
import { CancelOrderDto, PlaceOrderDto, ReturnOrderDto, TrackOrderDto } from './dto/orders.dto.js';
import { GuestAccessService } from './guest-access.service.js';
import type { OrderDto } from './order.mapper.js';
import { OrdersService, type OrderViewer, type PlacedOrderDto } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly idempotency: IdempotencyService,
    private readonly guests: GuestAccessService,
  ) {}

  private viewer(req: Request, user: RequestUser | undefined): OrderViewer {
    return { user, guestNumbers: this.guests.read(req) };
  }

  /**
   * Place an order (guests allowed). Send an `Idempotency-Key` header so a retried request can't create two orders.
   * Online orders return `{ ...order, payment }` where `payment` is what Razorpay Checkout needs (or `mock: true`).
   */
  @OptionalAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  async place(
    @Body() dto: PlaceOrderDto,
    @IdempotencyKeyHeader() key: string | undefined,
    @CurrentUser() user: RequestUser | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PlacedOrderDto> {
    const result = await this.idempotency.run({ scope: 'POST /orders', key, userId: user?.userId, payload: dto }, () => this.orders.place(dto, user));
    if (!user) this.guests.grant(req, res, result.number);
    return result;
  }

  @Get()
  list(@CurrentUser() user: RequestUser): Promise<OrderDto[]> {
    return this.orders.listMine(user.userId);
  }

  // Declared before `:number` routes so "track" is never read as an order number.
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('track')
  track(@Body() dto: TrackOrderDto): Promise<OrderDto> {
    return this.orders.track(dto.number, dto.contact);
  }

  @OptionalAuth()
  @Get(':number')
  get(@Param('number') number: string, @CurrentUser() user: RequestUser | undefined, @Req() req: Request): Promise<OrderDto> {
    return this.orders.get(number, this.viewer(req, user));
  }

  @OptionalAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post(':number/cancel')
  cancel(@Param('number') number: string, @Body() dto: CancelOrderDto, @CurrentUser() user: RequestUser | undefined, @Req() req: Request): Promise<OrderDto> {
    return this.orders.cancel(number, dto.reason, this.viewer(req, user));
  }

  @OptionalAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post(':number/return')
  requestReturn(@Param('number') number: string, @Body() dto: ReturnOrderDto, @CurrentUser() user: RequestUser | undefined, @Req() req: Request): Promise<OrderDto> {
    return this.orders.requestReturn(number, dto.reason, this.viewer(req, user));
  }

  /** New Razorpay payment for an unpaid online order (retry after a failed or abandoned attempt). */
  @OptionalAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post(':number/pay')
  pay(@Param('number') number: string, @CurrentUser() user: RequestUser | undefined, @Req() req: Request): Promise<CheckoutPayment> {
    return this.orders.startPayment(number, this.viewer(req, user));
  }
}
