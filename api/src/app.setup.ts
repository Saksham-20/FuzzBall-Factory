import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import type { Env } from './config/env.js';
import { originCheck, parseOrigins } from './common/origin-check.js';
import { createValidationPipe } from './common/validation.js';

/** Everything main.ts configures on the Nest app. Shared with e2e tests so they run the real setup. */
export function configureApp(app: INestApplication) {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  const proxyHops = config.get('TRUST_PROXY', { infer: true });
  if (proxyHops > 0) (app as NestExpressApplication).set('trust proxy', proxyHops);

  // Body parsing is configured here (create the app with `bodyParser: false`) so only the Razorpay webhook keeps
  // its raw bytes for HMAC verification; every other route pays nothing for them.
  app.use('/payments/razorpay/webhook', json({ verify: (req, _res, buf) => void ((req as { rawBody?: Buffer }).rawBody = buf) }));
  app.use(json());
  app.use(urlencoded({ extended: true }));
  app.use(originCheck(parseOrigins(config.get('WEB_ORIGIN', { infer: true }))));
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: parseOrigins(config.get('WEB_ORIGIN', { infer: true })),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();
}
