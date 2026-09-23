import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { GuestAccessService } from './guest-access.service.js';
import { OrderNotifier } from './order-notifier.service.js';
import { OrderStateService } from './order-state.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

/**
 * Exports `OrderStateService` (the admin module calls `transition(number, to, actor, { note, courier, awb })`),
 * `OrdersService` (guest-aware reads) and, via the barrel files, `toOrderDto` / `ORDER_INCLUDE` / `ORDER_NEXT`.
 */
@Module({
  imports: [PaymentsModule, PricingModule, SettingsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderStateService, OrderNotifier, GuestAccessService],
  exports: [OrdersService, OrderStateService, OrderNotifier],
})
export class OrdersModule {}
