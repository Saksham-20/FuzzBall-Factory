import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { isProduction, type Env } from '../config/env.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import type { RequestUser } from '../common/types/auth.types.js';
import type { UserDto } from '../users/user.mapper.js';
import { AuthService, type AuthResult } from './auth.service.js';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies, type CookieConfig } from './cookies.js';
import { ForgotPasswordDto, LoginDto, ResetPasswordDto, SignupDto } from './dto/auth.dto.js';
import { TokenService } from './token.service.js';

/** 5 requests per minute per IP for credential-guessing surfaces. */
const STRICT = { default: { limit: 5, ttl: 60_000 } };
/** Refresh is called automatically by the web client (multiple tabs), so it gets more room. */
const REFRESH_LIMIT = { default: { limit: 30, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle(STRICT)
  @Post('signup')
  async signup(@Body() dto: SignupDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<UserDto> {
    return this.respond(res, await this.auth.signup(dto, meta(req)));
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<UserDto> {
    return this.respond(res, await this.auth.login(dto.identifier, dto.password, meta(req)));
  }

  @Public()
  @Throttle(REFRESH_LIMIT)
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<UserDto> {
    try {
      return this.respond(res, await this.auth.refresh(readCookie(req, REFRESH_COOKIE), meta(req)));
    } catch (err) {
      clearAuthCookies(res, this.cookieConfig());
      throw err;
    }
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readCookie(req, REFRESH_COOKIE));
    clearAuthCookies(res, this.cookieConfig());
  }

  @Get('me')
  me(@CurrentUser() user: RequestUser): Promise<UserDto> {
    return this.auth.me(user.userId);
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(204)
  @Post('forgot')
  async forgot(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.auth.forgot(dto.email);
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(204)
  @Post('reset')
  async reset(@Body() dto: ResetPasswordDto, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.reset(dto.token, dto.password);
    clearAuthCookies(res, this.cookieConfig());
  }

  private respond(res: Response, result: AuthResult): UserDto {
    setAuthCookies(res, result.tokens, this.cookieConfig());
    return result.user;
  }

  private cookieConfig(): CookieConfig {
    return {
      secure: isProduction({ NODE_ENV: this.config.get('NODE_ENV', { infer: true }) }),
      domain: this.config.get('COOKIE_DOMAIN', { infer: true }),
      accessTtlMs: this.tokens.accessTtlMs,
      refreshTtlMs: this.tokens.refreshTtlMs,
    };
  }
}

const meta = (req: Request) => ({ userAgent: req.headers['user-agent'], ip: req.ip });
const readCookie = (req: Request, name: string): string | undefined => (req.cookies as Record<string, string> | undefined)?.[name] || undefined;
