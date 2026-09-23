import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.js';
import { CommonModule } from './common/common.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CustomModule } from './custom/custom.module.js';
import { AdminModule } from './admin/admin.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { ShippingModule } from './shipping/shipping.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { AccountModule } from './account/account.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { HealthController } from './health/health.controller.js';

/**
 * Add new domain modules to `imports` (catalog, cart, orders, custom, payments, admin…).
 * Global infrastructure (Prisma, config, common guards/filters, notifications) is already wired.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Default limit for every route; auth routes override with @Throttle (see auth.controller.ts).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    CommonModule,
    NotificationsModule,
    AuthModule,
    CustomModule,
    AdminModule,
    SettingsModule,
    CatalogModule,
    ShippingModule,
    PricingModule,
    PaymentsModule,
    OrdersModule,
    AccountModule,
    ReviewsModule,
    UploadsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
