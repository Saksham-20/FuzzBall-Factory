import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../generated/prisma/enums.js';
import { forbidden, unauthorized } from '../errors.js';
import { IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY } from '../decorators/public.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthedRequest } from '../types/auth.types.js';

const ADMIN_PATH_PREFIX = '/admin';

/**
 * Runs after JwtAuthGuard. `@Roles(...)` restricts a handler/controller.
 * Fail-closed under `/admin`: an admin route that forgets `@Roles('admin')` is refused for everyone
 * rather than silently open to every customer.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets);
    const request = context.switchToHttp().getRequest<AuthedRequest>();

    if (!required || required.length === 0) {
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
      const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, targets);
      const path = request.path ?? '';
      if (!isPublic && !optional && (path === ADMIN_PATH_PREFIX || path.startsWith(`${ADMIN_PATH_PREFIX}/`))) {
        throw forbidden('This admin route declares no required role. Add @Roles(...) to it.');
      }
      return true;
    }

    if (!request.user) throw unauthorized();
    if (!required.includes(request.user.role)) throw forbidden();
    return true;
  }
}
