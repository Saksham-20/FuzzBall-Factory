import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator.js';
import { reportError } from '../common/error-reporter.js';
import { ClientErrorDto } from './client-errors.dto.js';

/**
 * The storefront's error screens ("Snagged a thread") tell us when a visitor hit a crash, so it reaches Sentry next to the
 * API's own errors without shipping a browser SDK. Anonymous by design, so it is tightly limited: ten a minute per IP, short
 * fields only, nothing stored. The stack never leaves the browser, only the message and Next's digest (which finds the
 * full server-side log line).
 */
@Controller('client-errors')
export class ClientErrorsController {
  private readonly logger = new Logger(ClientErrorsController.name);

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(204)
  @Post()
  report(@Body() dto: ClientErrorDto): void {
    this.logger.warn(`Storefront ${dto.kind} error${dto.digest ? ` (digest ${dto.digest})` : ''} on ${dto.path ?? 'unknown path'}: ${dto.message}`);
    reportError(new Error(`Storefront error: ${dto.message}`), { area: 'web', extra: { kind: dto.kind, digest: dto.digest, path: dto.path } });
  }
}
