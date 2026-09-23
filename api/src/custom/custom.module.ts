import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { CustomController } from './custom.controller.js';
import { CustomStateService } from './custom-state.service.js';
import { CustomService } from './custom.service.js';
import { QuoteExpiryService } from './quote-expiry.service.js';

/**
 * Custom work orders: customer endpoints, the state machine, and the payment hooks (deposit → IN_PROGRESS,
 * balance → READY_TO_SHIP). The admin side lives in `AdminModule` and reuses the exported services.
 */
@Module({
  imports: [PaymentsModule, SettingsModule],
  controllers: [CustomController],
  providers: [CustomService, CustomStateService, QuoteExpiryService],
  exports: [CustomStateService, QuoteExpiryService, CustomService],
})
export class CustomModule {}
