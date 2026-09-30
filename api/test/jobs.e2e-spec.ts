import { ConfigService } from '@nestjs/config';
import { JobRunner } from '../src/jobs/job-runner.service.js';
import { bootApp, type TestApp } from './helpers/e2e.js';

describe('JobRunner (e2e)', () => {
  let t: TestApp;
  let config: ConfigService;
  beforeAll(async () => {
    t = await bootApp();
    config = t.app.get(ConfigService);
  });
  afterAll(async () => {
    await t.app.close();
  });

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const name = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  it('does nothing under NODE_ENV=test unless forced (crons stay off in the suite)', async () => {
    const runner = new JobRunner(t.prisma, config as never);
    let ran = 0;
    expect(await runner.run(name(), () => Promise.resolve(ran++))).toBe(false);
    expect(ran).toBe(0);
    expect(await runner.run(name(), () => Promise.resolve(ran++), { force: true })).toBe(true);
    expect(ran).toBe(1);
  });

  it('never runs the same job twice at once, across separate runners (separate processes in production)', async () => {
    const a = new JobRunner(t.prisma, config as never);
    const b = new JobRunner(t.prisma, config as never);
    const job = name();
    let ran = 0;
    const work = async () => {
      ran += 1;
      await sleep(300);
    };
    const results = await Promise.all([a.run(job, work, { force: true }), b.run(job, work, { force: true })]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(ran).toBe(1);
  });

  it('skips an overlapping tick in the same process', async () => {
    const runner = new JobRunner(t.prisma, config as never);
    const job = name();
    const first = runner.run(job, () => sleep(200), { force: true });
    expect(await runner.run(job, () => Promise.resolve(), { force: true })).toBe(false);
    expect(await first).toBe(true);
  });

  it('a failing job is logged not thrown, and releases its lock for the next tick', async () => {
    const runner = new JobRunner(t.prisma, config as never);
    const job = name();
    expect(await runner.run(job, () => Promise.reject(new Error('boom')), { force: true })).toBe(false);
    expect(await runner.run(job, () => Promise.resolve(), { force: true })).toBe(true);
  });
});
