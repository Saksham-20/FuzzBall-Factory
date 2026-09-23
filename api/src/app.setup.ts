import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Env } from './config/env.js';
import { createValidationPipe } from './common/validation.js';

/** Everything main.ts configures on the Nest app. Shared with e2e tests so they run the real setup. */
export function configureApp(app: INestApplication) {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  const proxyHops = config.get('TRUST_PROXY', { infer: true });
  if (proxyHops > 0) (app as NestExpressApplication).set('trust proxy', proxyHops);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config
      .get('WEB_ORIGIN', { infer: true })
      .split(',')
      .map((o) => o.trim().replace(/\/$/, ''))
      .filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    maxAge: 600,
  });
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();
}
