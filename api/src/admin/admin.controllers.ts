import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { RequestUser } from '../common/types/auth.types.js';
import type { CategoryDto, ProductDto } from '../catalog/product.mapper.js';
import type { CustomRequestDto } from '../custom/custom.mapper.js';
import { QuoteInputDto } from '../custom/dto/custom.dto.js';
import type { StoreSettings } from '../settings/settings.types.js';
import { AdminCategoriesService } from './admin-categories.service.js';
import { AdminCouponsService, type CouponDto } from './admin-coupons.service.js';
import { AdminCustomService, type AdminCtx } from './admin-custom.service.js';
import { AdminCustomersService, type CustomerDetail, type CustomerRow } from './admin-customers.service.js';
import { AdminDashboardService, type DashboardDto } from './admin-dashboard.service.js';
import { AdminMaterialsService, type MaterialDto } from './admin-materials.service.js';
import { AdminOrdersService, type AdminOrderDto, type PackingSlipDto } from './admin-orders.service.js';
import { AdminProductsService } from './admin-products.service.js';
import { AdminReviewsService, type ReviewDto } from './admin-reviews.service.js';
import { AdminSettingsService } from './admin-settings.service.js';
import { ClientIp } from './audit.service.js';
import { AdminMessageDto, ApprovalRequestDto, DeclineCustomDto, ProgressDto, ShipCustomDto } from './dto/admin-custom.dto.js';
import { CategoryInputDto } from './dto/category.dto.js';
import { CouponInputDto } from './dto/coupon.dto.js';
import { MaterialInputDto, MaterialStockAdjustDto } from './dto/material.dto.js';
import { OrderNotesDto, OrderStatusDto } from './dto/order.dto.js';
import { ProductInputDto, ProductStatusDto } from './dto/product.dto.js';
import { CustomerListQuery, CustomListQuery, OrderListQuery, ProductListQuery, ReviewListQuery } from './dto/query.dto.js';
import { ReviewReplyDto, ReviewStatusDto, SettingsInputDto } from './dto/settings.dto.js';

/**
 * Every controller below is `@Roles('admin')` at class level (the global RolesGuard also refuses any `/admin`
 * route that forgets it). They only parse input and call a service; every write is audited in the service.
 */
const ctx = (user: RequestUser, ip?: string): AdminCtx => ({ actorId: user.userId, ip });

@Roles('admin')
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get()
  get(): Promise<DashboardDto> {
    return this.dashboard.get();
  }
}

@Roles('admin')
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly products: AdminProductsService) {}

  @Get()
  list(@Query() q: ProductListQuery): Promise<ProductDto[]> {
    return this.products.list(q.q, q.status);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<ProductDto> {
    return this.products.get(id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: ProductInputDto, @ClientIp() ip?: string): Promise<ProductDto> {
    return this.products.create(ctx(user, ip), dto);
  }

  /** Bulk publish / draft / archive. Declared before `:id` routes so `status` is never read as an id. */
  @HttpCode(200)
  @Post('status')
  setStatus(@CurrentUser() user: RequestUser, @Body() dto: ProductStatusDto, @ClientIp() ip?: string): Promise<{ updated: number }> {
    return this.products.setStatus(ctx(user, ip), dto.ids, dto.status);
  }

  @Put(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: ProductInputDto, @ClientIp() ip?: string): Promise<ProductDto> {
    return this.products.update(ctx(user, ip), id, dto);
  }

  /** Archives (never hard-deletes: orders keep their snapshots). */
  @Delete(':id')
  archive(@CurrentUser() user: RequestUser, @Param('id') id: string, @ClientIp() ip?: string): Promise<ProductDto> {
    return this.products.archive(ctx(user, ip), id);
  }
}

@Roles('admin')
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: AdminCategoriesService) {}

  @Get()
  list(): Promise<CategoryDto[]> {
    return this.categories.list();
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CategoryInputDto, @ClientIp() ip?: string): Promise<CategoryDto> {
    return this.categories.create(ctx(user, ip), dto);
  }

  /** Upsert by slug. */
  @Put(':slug')
  save(@CurrentUser() user: RequestUser, @Param('slug') slug: string, @Body() dto: CategoryInputDto, @ClientIp() ip?: string): Promise<CategoryDto> {
    return this.categories.save(ctx(user, ip), slug, dto);
  }

  @HttpCode(204)
  @Delete(':slug')
  remove(@CurrentUser() user: RequestUser, @Param('slug') slug: string, @ClientIp() ip?: string): Promise<void> {
    return this.categories.remove(ctx(user, ip), slug);
  }
}

@Roles('admin')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get()
  list(@Query() q: OrderListQuery): Promise<AdminOrderDto[]> {
    return this.orders.list(q);
  }

  @Get(':number')
  get(@Param('number') number: string): Promise<AdminOrderDto> {
    return this.orders.get(number);
  }

  @Get(':number/packing-slip')
  packingSlip(@Param('number') number: string): Promise<PackingSlipDto> {
    return this.orders.packingSlip(number);
  }

  /** The one way to change an order's status (delegates to OrderStateService). SHIPPED needs courier + awb. */
  @HttpCode(200)
  @Post(':number/status')
  updateStatus(@CurrentUser() user: RequestUser, @Param('number') number: string, @Body() dto: OrderStatusDto, @ClientIp() ip?: string): Promise<AdminOrderDto> {
    return this.orders.updateStatus(ctx(user, ip), number, dto);
  }

  @Patch(':number/notes')
  notes(@CurrentUser() user: RequestUser, @Param('number') number: string, @Body() dto: OrderNotesDto, @ClientIp() ip?: string): Promise<AdminOrderDto> {
    return this.orders.updateNotes(ctx(user, ip), number, dto);
  }
}

@Roles('admin')
@Controller('admin/custom')
export class AdminCustomController {
  constructor(private readonly custom: AdminCustomService) {}

  @Get()
  list(@Query() q: CustomListQuery): Promise<CustomRequestDto[]> {
    return this.custom.list(q.status);
  }

  @Get(':wo')
  get(@Param('wo') wo: string): Promise<CustomRequestDto> {
    return this.custom.get(wo);
  }

  /** Send (or re-send after a counter / expiry) a quote. */
  @HttpCode(200)
  @Post(':wo/quote')
  sendQuote(@CurrentUser() user: RequestUser, @Param('wo') wo: string, @Body() dto: QuoteInputDto, @ClientIp() ip?: string): Promise<CustomRequestDto> {
    return this.custom.sendQuote(ctx(user, ip), wo, dto);
  }

  @HttpCode(200)
  @Post(':wo/decline')
  decline(@CurrentUser() user: RequestUser, @Param('wo') wo: string, @Body() dto: DeclineCustomDto, @ClientIp() ip?: string): Promise<CustomRequestDto> {
    return this.custom.decline(ctx(user, ip), wo, dto);
  }

  @HttpCode(200)
  @Post(':wo/accept-counter')
  acceptCounter(@CurrentUser() user: RequestUser, @Param('wo') wo: string, @ClientIp() ip?: string): Promise<CustomRequestDto> {
    return this.custom.acceptCounter(ctx(user, ip), wo);
  }

  @HttpCode(200)
  @Post(':wo/under-review')
  underReview(@CurrentUser() user: RequestUser, @Param('wo') wo: string, @ClientIp() ip?: string): Promise<CustomRequestDto> {
    return this.custom.markUnderReview(ctx(user, ip), wo);
  }

  @HttpCode(200)
  @Post(':wo/messages')
  message(@CurrentUser() user: RequestUser, @Param('wo') wo: string, @Body() dto: AdminMessageDto, @ClientIp() ip?: string): Promise<CustomRequestDto> {
    return this.custom.message(ctx(user, ip), wo, dto);
  }

  @HttpCode(200)
  @Post(':wo/progress')
  progress(@CurrentUser() user: RequestUser, @Param('wo') wo: string, @Body() dto: ProgressDto, @ClientIp() ip?: string): Promise<CustomRequestDto> {
    return this.custom.addProgress(ctx(user, ip), wo, dto);
  }

  @HttpCode(200)
  @Post(':wo/request-approval')
  requestApproval(@CurrentUser() user: RequestUser, @Param('wo') wo: string, @Body() dto: ApprovalRequestDto, @ClientIp() ip?: string): Promise<CustomRequestDto> {
    return this.custom.requestApproval(ctx(user, ip), wo, dto);
  }

  @HttpCode(200)
  @Post(':wo/ship')
  ship(@CurrentUser() user: RequestUser, @Param('wo') wo: string, @Body() dto: ShipCustomDto, @ClientIp() ip?: string): Promise<CustomRequestDto> {
    return this.custom.markShipped(ctx(user, ip), wo, dto);
  }

  @HttpCode(200)
  @Post(':wo/deliver')
  deliver(@CurrentUser() user: RequestUser, @Param('wo') wo: string, @ClientIp() ip?: string): Promise<CustomRequestDto> {
    return this.custom.markDelivered(ctx(user, ip), wo);
  }
}

@Roles('admin')
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly customers: AdminCustomersService) {}

  @Get()
  list(@Query() q: CustomerListQuery): Promise<CustomerRow[]> {
    return this.customers.list(q.q);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<CustomerDetail> {
    return this.customers.get(id);
  }
}

@Roles('admin')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: AdminReviewsService) {}

  @Get()
  list(@Query() q: ReviewListQuery): Promise<ReviewDto[]> {
    return this.reviews.list(q.status);
  }

  @Patch(':id')
  moderate(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: ReviewStatusDto, @ClientIp() ip?: string): Promise<ReviewDto> {
    return this.reviews.moderate(ctx(user, ip), id, dto.status, dto.disputeReason);
  }

  @Put(':id/reply')
  setReply(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: ReviewReplyDto, @ClientIp() ip?: string): Promise<ReviewDto> {
    return this.reviews.setReply(ctx(user, ip), id, dto.reply);
  }

  @Delete(':id/reply')
  clearReply(@CurrentUser() user: RequestUser, @Param('id') id: string, @ClientIp() ip?: string): Promise<ReviewDto> {
    return this.reviews.clearReply(ctx(user, ip), id);
  }
}

@Roles('admin')
@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(private readonly coupons: AdminCouponsService) {}

  @Get()
  list(): Promise<CouponDto[]> {
    return this.coupons.list();
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CouponInputDto, @ClientIp() ip?: string): Promise<CouponDto> {
    return this.coupons.create(ctx(user, ip), dto);
  }

  /** Upsert by code. */
  @Put(':code')
  save(@CurrentUser() user: RequestUser, @Param('code') code: string, @Body() dto: CouponInputDto, @ClientIp() ip?: string): Promise<CouponDto> {
    return this.coupons.save(ctx(user, ip), code, dto);
  }

  @HttpCode(204)
  @Delete(':code')
  remove(@CurrentUser() user: RequestUser, @Param('code') code: string, @ClientIp() ip?: string): Promise<void> {
    return this.coupons.remove(ctx(user, ip), code);
  }
}

@Roles('admin')
@Controller('admin/materials')
export class AdminMaterialsController {
  constructor(private readonly materials: AdminMaterialsService) {}

  @Get()
  list(): Promise<MaterialDto[]> {
    return this.materials.list();
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: MaterialInputDto, @ClientIp() ip?: string): Promise<MaterialDto> {
    return this.materials.create(ctx(user, ip), dto);
  }

  @Put(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: MaterialInputDto, @ClientIp() ip?: string): Promise<MaterialDto> {
    return this.materials.update(ctx(user, ip), id, dto);
  }

  /** Soft delete: sets `archived: true`. */
  @HttpCode(204)
  @Delete(':id')
  archive(@CurrentUser() user: RequestUser, @Param('id') id: string, @ClientIp() ip?: string): Promise<void> {
    return this.materials.archive(ctx(user, ip), id);
  }

  @HttpCode(200)
  @Post(':id/adjust-stock')
  adjustStock(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: MaterialStockAdjustDto, @ClientIp() ip?: string): Promise<MaterialDto> {
    return this.materials.adjustStock(ctx(user, ip), id, dto);
  }
}

@Roles('admin')
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settings: AdminSettingsService) {}

  @Get()
  get(): Promise<StoreSettings> {
    return this.settings.get();
  }

  @Put()
  update(@CurrentUser() user: RequestUser, @Body() dto: SettingsInputDto, @ClientIp() ip?: string): Promise<StoreSettings> {
    return this.settings.update(ctx(user, ip), dto);
  }
}

export const ADMIN_CONTROLLERS = [
  AdminDashboardController,
  AdminProductsController,
  AdminCategoriesController,
  AdminOrdersController,
  AdminCustomController,
  AdminCustomersController,
  AdminReviewsController,
  AdminCouponsController,
  AdminMaterialsController,
  AdminSettingsController,
];
