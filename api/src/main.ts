import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { flushErrorReporting, initErrorReporting, reportError } from './common/error-reporter.js';
import { validateEnv, type Env } from './config/env.js';

async function bootstrap() {
  // Started before Nest so a crash while booting is reported too. Nest's ConfigModule reads .env later and lets the
  // real environment win; do the same here so both see one set of values.
  try {
    process.loadEnvFile('.env');
  } catch {
    // No .env file: rely on the real environment.
  }
  const env = validateEnv(process.env);
  const reporting = initErrorReporting({ dsn: env.SENTRY_DSN, environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV, release: env.SENTRY_RELEASE });
  if (!reporting && env.NODE_ENV === 'production') new Logger('Bootstrap').warn('SENTRY_DSN is not set: failed refunds, payment mismatches and crashes will only reach the log');
  // Body parsing (and the webhook's raw body) is set up in configureApp; logs are buffered until pino is ready.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  configureApp(app);

  const port = app.get<ConfigService<Env, true>>(ConfigService).get('PORT', { infer: true });
  // HOST defaults to 127.0.0.1 in production (behind a reverse proxy) and 0.0.0.0 elsewhere; see config/env.ts.
  await app.listen(port, app.get<ConfigService<Env, true>>(ConfigService).get('HOST', { infer: true }));
  new Logger('Bootstrap').log(`API listening on http://localhost:${port}`);
}

bootstrap().catch(async (err: unknown) => {
  console.error(err);
  reportError(err, { area: 'boot' });
  await flushErrorReporting();
  process.exit(1);
});
