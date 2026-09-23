import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthedRequest, RequestUser } from '../types/auth.types.js';

/**
 * The authenticated user (`{ userId, role }`). On `@OptionalAuth()` routes it is `undefined` for guests,
 * so type the parameter as `RequestUser | undefined` there.
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser | undefined => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});
