import 'reflect-metadata';
import { PATH_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../common/decorators/roles.decorator.js';
import { IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY } from '../common/decorators/public.decorator.js';
import { adminRoutes } from '../../test/helpers/admin-routes.js';
import { ADMIN_CONTROLLERS } from './admin.controllers.js';

describe('admin controllers are locked to admins', () => {
  it('every controller sits under /admin and requires @Roles("admin") at class level', () => {
    for (const controller of ADMIN_CONTROLLERS) {
      expect(Reflect.getMetadata(PATH_METADATA, controller), controller.name).toMatch(/^admin\//);
      expect(Reflect.getMetadata(ROLES_KEY, controller), controller.name).toEqual(['admin']);
    }
  });

  it('no admin handler opts out of authentication', () => {
    for (const controller of ADMIN_CONTROLLERS) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, controller)).toBeUndefined();
      expect(Reflect.getMetadata(OPTIONAL_AUTH_KEY, controller)).toBeUndefined();
      for (const handler of Object.getOwnPropertyNames(controller.prototype)) {
        const fn = (controller.prototype as unknown as Record<string, unknown>)[handler] as object;
        expect(Reflect.getMetadata(IS_PUBLIC_KEY, fn), `${controller.name}.${handler}`).toBeUndefined();
      }
    }
  });

  it('exposes the expected number of routes', () => {
    const routes = adminRoutes();
    expect(routes.length).toBeGreaterThanOrEqual(35);
    expect(new Set(routes.map((r) => `${r.method} ${r.path}`)).size).toBe(routes.length);
  });
});
