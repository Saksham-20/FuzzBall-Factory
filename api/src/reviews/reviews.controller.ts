import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { OptionalAuth, Public } from '../common/decorators/public.decorator.js';
import type { RequestUser } from '../common/types/auth.types.js';
import { CreateReviewDto } from './dto/reviews.dto.js';
import type { ReviewDto } from './review.mapper.js';
import { ReviewsService } from './reviews.service.js';

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get('products/:id/reviews')
  list(@Param('id') productId: string): Promise<ReviewDto[]> {
    return this.reviews.listPublished(productId);
  }

  /** `{ canReview }`; guests get `false` (not a 401), like the web mock. */
  @OptionalAuth()
  @Get('products/:id/can-review')
  async canReview(@Param('id') productId: string, @CurrentUser() user: RequestUser | undefined): Promise<{ canReview: boolean }> {
    return { canReview: await this.reviews.canReview(productId, user?.userId) };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reviews')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateReviewDto): Promise<ReviewDto> {
    return this.reviews.create(user.userId, dto);
  }
}
