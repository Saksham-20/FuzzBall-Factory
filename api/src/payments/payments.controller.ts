import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { IdempotencyKeyHeader } from '../common/decorators/idempotency-key.decorator.js';
import { OptionalAuth, Public } from '../common/decorators/public.decorator.js';
import { IdempotencyService } from '../common/idempotency/idempotency.service.js';
import type { RequestUser } from '../common/types/auth.types.js';
import { MockConfirmDto, VerifyPaymentDto } from './dto/payments.dto.js';
import { PaymentsService, type PaymentResult } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly idempotency: IdempotencyService,
  ) {}

  /**
   * Razorpay Checkout success handler: HMAC-verify `order_id|payment_id`, then mark PAID (and advance the
   * order / work order) in one transaction. Signature is the proof of authenticity, so guests may call it.
   */
  @OptionalAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('razorpay/verify')
  verify(@Body() dto: VerifyPaymentDto, @IdempotencyKeyHeader() key: string | undefined, @CurrentUser() user: RequestUser | undefined): Promise<PaymentResult> {
    return this.idempotency.run({ scope: 'POST /payments/razorpay/verify', key, userId: user?.userId, payload: dto }, () =>
      this.payments.verify({ razorpayOrderId: dto.razorpay_order_id, razorpayPaymentId: dto.razorpay_payment_id, signature: dto.razorpay_signature }),
    );
  }

  /** Razorpay -> us. No auth, no throttle: authenticity is the HMAC of the raw body, dedupe is by event id. */
  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @Post('razorpay/webhook')
  webhook(@Req() req: RawBodyRequest<Request>): Promise<{ status: string }> {
    const header = (name: string) => {
      const v = req.headers[name];
      return Array.isArray(v) ? v[0] : v;
    };
    return this.payments.handleWebhook(req.rawBody, header('x-razorpay-signature'), header('x-razorpay-event-id'));
  }

  /**
   * DEV ONLY. Simulates the Razorpay callback for a `mock: true` payment. Answers 404 when Razorpay keys are
   * configured or NODE_ENV is production. `ok: false` returns 402 and leaves the order pending for a retry.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('mock/:paymentId/confirm')
  mockConfirm(@Param('paymentId') paymentId: string, @Body() dto: MockConfirmDto): Promise<PaymentResult> {
    return this.payments.mockConfirm(paymentId, dto.ok);
  }
}
