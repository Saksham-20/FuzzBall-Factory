import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ACCESS_COOKIE } from '../../auth/cookies.js';
import { ErrorCode, unauthorized } from '../errors.js';
import { IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY } from '../decorators/public.decorator.js';
import type { AccessTokenPayload, AuthedRequest } from '../types/auth.types.js';

/**
 * Global guard: every route needs a valid access token unless it is `@Public()`.
 *  - token from the `fbf_at` httpOnly cookie, or `Authorization: Bearer` (tooling)
 *  - user is re-read from the DB on each request, so `tokenVersion` bumps (logout-everywhere,
 *    password reset) and deleted users take effect immediately, and the role is never trusted from the token.
 *  - `@OptionalAuth()` routes: attach the user when a valid token is present, otherwise continue as guest.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
    const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, targets);
    if (isPublic && !optional) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = extractAccessToken(request);
    try {
      if (!token) throw unauthorized();
      request.user = await this.authenticate(token);
      return true;
    } catch (err) {
      if (optional) return true; // guest
      throw err;
    }
  }

  private async authenticate(token: string) {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, { secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }) });
    } catch {
      throw unauthorized('Your session has expired. Please log in again.', ErrorCode.SESSION_EXPIRED);
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, tokenVersion: true } });
    if (!user || user.tokenVersion !== payload.tv) {
      throw unauthorized('Your session has expired. Please log in again.', ErrorCode.SESSION_EXPIRED);
    }
    return { userId: user.id, role: user.role };
  }
}

export function extractAccessToken(request: AuthedRequest): string | undefined {
  const header = request.headers.authorization;
  if (header) {
    const [type, token] = header.split(' ');
    if (type === 'Bearer' && token) return token;
  }
  const cookie = (request.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
  return cookie || undefined;
}
