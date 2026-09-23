import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import type { Env } from '../config/env.js';
import { PaymentsController } from './payments.controller.js';
import { PAYMENTS_PORT } from './payments.types.js';
import { PaymentsService } from './payments.service.js';
import { RAZORPAY_GATEWAY, SdkRazorpayGateway } from './razorpay.gateway.js';

/**
 * Import this module from any domain module that takes payments, then inject either the class
 * (`PaymentsService`, for refunds / listeners) or the port (`@Inject(PAYMENTS_PORT) PaymentsPort`).
 */
@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    { provide: PAYMENTS_PORT, useExisting: PaymentsService },
    {
      provide: RAZORPAY_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const keyId = config.get('RAZORPAY_KEY_ID', { infer: true });
        const secret = config.get('RAZORPAY_KEY_SECRET', { infer: true });
        if (keyId && secret) return new SdkRazorpayGateway(keyId, secret);
        if (keyId || secret) new Logger('Payments').warn('Only one of RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET is set: treating Razorpay as not configured');
        return null;
      },
    },
  ],
  exports: [PaymentsService, PAYMENTS_PORT],
})
export class PaymentsModule {}
