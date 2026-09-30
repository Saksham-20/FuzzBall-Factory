import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  // Body parsing (and the webhook's raw body) is set up in configureApp; logs are buffered until pino is ready.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  configureApp(app);

  const port = app.get<ConfigService<Env, true>>(ConfigService).get('PORT', { infer: true });
  // HOST defaults to 127.0.0.1 in production (behind a reverse proxy) and 0.0.0.0 elsewhere; see config/env.ts.
  await app.listen(port, app.get<ConfigService<Env, true>>(ConfigService).get('HOST', { infer: true }));
  new Logger('Bootstrap').log(`API listening on http://localhost:${port}`);
}

await bootstrap();
