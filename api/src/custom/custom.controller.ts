import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { IdempotencyKeyHeader } from '../common/decorators/idempotency-key.decorator.js';
import { IdempotencyService } from '../common/idempotency/idempotency.service.js';
import type { RequestUser } from '../common/types/auth.types.js';
import type { CheckoutPayment } from '../payments/payments.types.js';
import type { CustomRequestDto } from './custom.mapper.js';
import { CustomService } from './custom.service.js';
import { CounterDto, CreateCustomDto, DeclineQuoteDto, MessageDto, RequestChangeDto } from './dto/custom.dto.js';

/** Counters, messages and new requests are cheap to abuse: tighter than the 100/min default. */
const TIGHT = { default: { limit: 10, ttl: 60_000 } };

/**
 * Customer work-order endpoints. Every route needs a logged-in user (global guard) and only ever touches the
 * caller's own work orders; anyone else's is a 404. Money-moving POSTs accept an `Idempotency-Key` header.
 */
@Controller('custom')
export class CustomController {
  constructor(
    private readonly custom: CustomService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Throttle(TIGHT)
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCustomDto, @IdempotencyKeyHeader() key?: string): Promise<CustomRequestDto> {
    return this.idempotency.run({ scope: 'POST /custom', key, userId: user.userId, payload: dto }, () => this.custom.create(user, dto));
  }

  @Get()
  list(@CurrentUser() user: RequestUser): Promise<CustomRequestDto[]> {
    return this.custom.list(user);
  }

  @Get(':wo')
  get(@CurrentUser() user: RequestUser, @Param('wo') wo: string): Promise<CustomRequestDto> {
    return this.custom.get(user, wo);
  }

  @Throttle(TIGHT)
  @HttpCode(200)
  @Post(':wo/messages')
  message(@CurrentUser() user: RequestUser, @Param('wo') wo: string, @Body() dto: MessageDto): Promise<CustomRequestDto> {
    return this.custom.addMessage(user, wo, dto);
  }

  /** Accept the quote: work order → DEPOSIT_PENDING. Then call `pay-deposit` to get the payment to open. */
  @HttpCode(200)
  @Post(':wo/quotes/:id/accept')
  accept(@CurrentUser() user: RequestUser, @Param('wo') wo: string, @Param('id') id: string, @IdempotencyKeyHeader() key?: string): Promise<CustomRequestDto> {
    return this.idempotency.run({ scope: 'POST /custom/:wo/quotes/:id/accept', key, userId: user.userId, payload: { wo, id } }, () => this.custom.acceptQuote(user, wo, id));
  }

  @Throttle(TIGHT)
  @HttpCode(200)
  @Post(':wo/quotes/:id/counter')
  counter(@CurrentUser() user: RequestUser, @Param('wo') wo: string, @Param('id') id: string, @Body() dto: CounterDto): Promise<CustomRequestDto> {
    return this.custom.counterQuote(user, wo, id, dto);
  }

  @HttpCode(200)
  @Post(':wo/quotes/:id/decline')
  decline(@CurrentUser() user: RequestUser, @Param('wo') wo: string, @Param('id') id: string, @Body() dto: DeclineQuoteDto): Promise<CustomRequestDto> {
    return this.custom.declineQuote(user, wo, id, dto);
  }

  @HttpCode(200)
  @Post(':wo/approve')
  approve(@CurrentUser() user: RequestUser, @Param('wo') wo: string): Promise<CustomRequestDto> {
    return this.custom.approveFinal(user, wo);
  }

  /** Response is the work order plus `extraCharge` (true when this change goes beyond the quote's revisions). */
  @Throttle(TIGHT)
  @HttpCode(200)
  @Post(':wo/request-change')
  requestChange(@CurrentUser() user: RequestUser, @Param('wo') wo: string, @Body() dto: RequestChangeDto): Promise<CustomRequestDto & { extraCharge: boolean }> {
    return this.custom.requestChange(user, wo, dto);
  }

  /** Creates the deposit payment (DEPOSIT_PENDING only). Returns what the checkout needs; status moves on capture. */
  @Throttle(TIGHT)
  @HttpCode(200)
  @Post(':wo/pay-deposit')
  payDeposit(@CurrentUser() user: RequestUser, @Param('wo') wo: string, @IdempotencyKeyHeader() key?: string): Promise<CheckoutPayment> {
    return this.idempotency.run({ scope: 'POST /custom/:wo/pay-deposit', key, userId: user.userId, payload: { wo } }, () => this.custom.payDeposit(user, wo));
  }

  /** Creates the balance payment (BALANCE_PENDING only). */
  @Throttle(TIGHT)
  @HttpCode(200)
  @Post(':wo/pay-balance')
  payBalance(@CurrentUser() user: RequestUser, @Param('wo') wo: string, @IdempotencyKeyHeader() key?: string): Promise<CheckoutPayment> {
    return this.idempotency.run({ scope: 'POST /custom/:wo/pay-balance', key, userId: user.userId, payload: { wo } }, () => this.custom.payBalance(user, wo));
  }
}
