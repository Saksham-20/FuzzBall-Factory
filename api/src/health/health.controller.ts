import { Controller, Get, ServiceUnavailableException, type BeforeApplicationShutdown } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * `/health/live`: the process is up (no dependencies; a restart is the only fix, so this never checks the DB).
 * `/health/ready`: fit to take traffic: DB reachable, every migration finished, not draining. Deploys gate on it.
 * `/health` is kept as an alias of ready for older monitors.
 */
@Controller('health')
export class HealthController implements BeforeApplicationShutdown {
  private draining = false;

  constructor(private readonly prisma: PrismaService) {}

  /** SIGTERM: report not-ready first so the proxy stops sending traffic while in-flight requests finish. */
  beforeApplicationShutdown() {
    this.draining = true;
  }

  @Public()
  @SkipThrottle()
  @Get('live')
  live() {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }

  @Public()
  @SkipThrottle()
  @Get(['ready', ''])
  async ready() {
    if (this.draining) throw new ServiceUnavailableException('Shutting down');
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
    let pending: number;
    try {
      const rows = await this.prisma.$queryRaw<{ pending: bigint }[]>`select count(*) as pending from _prisma_migrations where finished_at is null and rolled_back_at is null`;
      pending = Number(rows[0]?.pending ?? 0);
    } catch {
      throw new ServiceUnavailableException('Migrations not applied');
    }
    if (pending > 0) throw new ServiceUnavailableException('Migrations not finished');
    return { status: 'ok', db: 'up', migrations: 'applied', uptime: Math.round(process.uptime()) };
  }
}
