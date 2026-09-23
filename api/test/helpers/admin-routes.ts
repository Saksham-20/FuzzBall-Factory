import 'reflect-metadata';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ADMIN_CONTROLLERS } from '../../src/admin/admin.controllers.js';

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

/** Every route of the admin controllers, with its verb and full path. */
export function adminRoutes() {
  const routes: { method: (typeof METHODS)[number]; path: string; controller: string; handler: string }[] = [];
  for (const controller of ADMIN_CONTROLLERS) {
    const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
    for (const handler of Object.getOwnPropertyNames(controller.prototype)) {
      if (handler === 'constructor') continue;
      const fn = (controller.prototype as unknown as Record<string, unknown>)[handler] as object;
      const verb = Reflect.getMetadata(METHOD_METADATA, fn) as number | undefined;
      if (verb === undefined) continue;
      const sub = (Reflect.getMetadata(PATH_METADATA, fn) as string) ?? '/';
      routes.push({ method: METHODS[verb], path: `/${base}${sub === '/' ? '' : `/${sub}`}`, controller: controller.name, handler });
    }
  }
  return routes;
}
