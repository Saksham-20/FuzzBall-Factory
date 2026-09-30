import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { RequestUser } from '../common/types/auth.types.js';
import { MergeWishlistDto } from './wishlist.dto.js';
import { WishlistService, type WishlistEntry } from './wishlist.service.js';

/** All routes need a signed-in user (the global guard); the user id always comes from the session. */
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(@CurrentUser() user: RequestUser): Promise<WishlistEntry[]> {
    return this.wishlist.list(user.userId);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(204)
  @Put(':productId')
  async add(@CurrentUser() user: RequestUser, @Param('productId') productId: string): Promise<void> {
    await this.wishlist.add(user.userId, productId);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(204)
  @Delete(':productId')
  async remove(@CurrentUser() user: RequestUser, @Param('productId') productId: string): Promise<void> {
    await this.wishlist.remove(user.userId, productId);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('merge')
  merge(@CurrentUser() user: RequestUser, @Body() dto: MergeWishlistDto): Promise<WishlistEntry[]> {
    return this.wishlist.merge(user.userId, dto.productIds);
  }
}
