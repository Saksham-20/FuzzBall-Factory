import { Module } from '@nestjs/common';
import { CustomModule } from '../custom/custom.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { AdminCategoriesService } from './admin-categories.service.js';
import { AdminCouponsService } from './admin-coupons.service.js';
import { AdminCustomService } from './admin-custom.service.js';
import { AdminCustomersService } from './admin-customers.service.js';
import { AdminDashboardService } from './admin-dashboard.service.js';
import { AdminMaterialsService } from './admin-materials.service.js';
import { AdminOrdersService } from './admin-orders.service.js';
import { AdminProductsService } from './admin-products.service.js';
import { AdminReviewsService } from './admin-reviews.service.js';
import { AdminSettingsService } from './admin-settings.service.js';
import { ADMIN_CONTROLLERS } from './admin.controllers.js';
import { AuditService } from './audit.service.js';

/** Thin admin API over the domain services. Every route is `@Roles('admin')` and every write is audited. */
@Module({
  imports: [CustomModule, OrdersModule, SettingsModule],
  controllers: ADMIN_CONTROLLERS,
  providers: [
    AuditService,
    AdminDashboardService,
    AdminProductsService,
    AdminCategoriesService,
    AdminOrdersService,
    AdminCustomService,
    AdminCustomersService,
    AdminReviewsService,
    AdminCouponsService,
    AdminMaterialsService,
    AdminSettingsService,
  ],
})
export class AdminModule {}
