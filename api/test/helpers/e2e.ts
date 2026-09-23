import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { hashPassword } from '../../src/common/password-hash.js';
import type { Role } from '../../src/generated/prisma/enums.js';
import { NotificationsService } from '../../src/notifications/notifications.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

export const PASSWORD = 'correct-horse-9';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  /** Every `notifications.send(event, payload)` call, in order. */
  sent: { event: string; payload: Record<string, unknown> }[];
}

/**
 * Boots the real app (real DB) with the mail sender replaced by a recorder. Rate limiting is switched off by
 * default (a long journey from one IP would trip it); pass `{ throttle: true }` to keep the real limits.
 */
export async function bootApp(opts: { throttle?: boolean } = {}): Promise<TestApp> {
  const sent: TestApp['sent'] = [];
  // The guard is registered as a global APP_GUARD, which the testing module cannot override by token: patch the
  // class instead. Vitest gives every test file its own module registry, so this never leaks into other files.
  if (!opts.throttle) ThrottlerGuard.prototype.canActivate = () => Promise.resolve(true);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(NotificationsService)
    .useValue({
      send: (event: string, payload: Record<string, unknown>) => {
        sent.push({ event, payload });
        return Promise.resolve();
      },
    })
    .compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService), sent };
}

export interface TestUser {
  id: string;
  email: string;
  agent: ReturnType<typeof request.agent>;
}

/** Creates a user straight in the DB (no signup throttle) and logs in through the real endpoint. */
export async function makeUser(t: TestApp, role: Role, label: string): Promise<TestUser> {
  const email = `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const user = await t.prisma.user.create({
    data: { name: `E2E ${label}`, email, phone: null, passwordHash: await hashPassword(PASSWORD), role },
  });
  const agent = request.agent(t.app.getHttpServer());
  await agent.post('/auth/login').send({ identifier: email, password: PASSWORD }).expect(200);
  return { id: user.id, email, agent };
}
