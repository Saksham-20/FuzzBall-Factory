import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { HashingService } from './hashing.service.js';
import { IdempotencyService } from './idempotency/idempotency.service.js';
import { NumberingService } from './numbering.service.js';

/**
 * Cross-cutting providers available everywhere (global): hashing, numbering, idempotency, JwtService.
 * Also registers the global guards (order matters: throttle, authenticate, authorise) and the exception filter.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [
    HashingService,
    NumberingService,
    IdempotencyService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtModule, HashingService, NumberingService, IdempotencyService],
})
export class CommonModule {}
