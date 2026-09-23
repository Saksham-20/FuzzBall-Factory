import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { setAuthCookies } from '../auth/cookies.js';
import { TokenService } from '../auth/token.service.js';
import { isProduction, type Env } from '../config/env.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { RequestUser } from '../common/types/auth.types.js';
import type { UserDto } from '../users/user.mapper.js';
import { AccountService } from './account.service.js';
import type { AddressDto } from './address.mapper.js';
import { ChangePasswordDto, SaveAddressDto, UpdateProfileDto } from './dto/account.dto.js';

/** Every route here is for the signed-in customer (the global guard requires it) and only ever touches their own rows. */
@Controller('account')
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get('profile')
  profile(@CurrentUser() user: RequestUser): Promise<UserDto> {
    return this.account.getProfile(user.userId);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto): Promise<UserDto> {
    return this.account.updateProfile(user.userId, dto);
  }

  /** Signs out every other device; this one keeps a fresh session (new cookies are set on the response). */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(204)
  @Post('password')
  async changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangePasswordDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const tokens = await this.account.changePassword(user.userId, dto, { userAgent: req.headers['user-agent'], ip: req.ip });
    setAuthCookies(res, tokens, {
      secure: isProduction({ NODE_ENV: this.config.get('NODE_ENV', { infer: true }) }),
      domain: this.config.get('COOKIE_DOMAIN', { infer: true }),
      accessTtlMs: this.tokens.accessTtlMs,
      refreshTtlMs: this.tokens.refreshTtlMs,
    });
  }

  @Get('addresses')
  addresses(@CurrentUser() user: RequestUser): Promise<AddressDto[]> {
    return this.account.listAddresses(user.userId);
  }

  @Post('addresses')
  createAddress(@CurrentUser() user: RequestUser, @Body() dto: SaveAddressDto): Promise<AddressDto> {
    return this.account.createAddress(user.userId, dto);
  }

  @Put('addresses/:id')
  updateAddress(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: SaveAddressDto): Promise<AddressDto> {
    return this.account.updateAddress(user.userId, id, dto);
  }

  @HttpCode(204)
  @Delete('addresses/:id')
  deleteAddress(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<void> {
    return this.account.deleteAddress(user.userId, id);
  }

  /** DPDP Act: records the request (fulfilled within 30 days). */
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(204)
  @Post('delete-request')
  deleteRequest(@CurrentUser() user: RequestUser, @Req() req: Request): Promise<void> {
    return this.account.requestDeletion(user.userId, req.ip);
  }
}
