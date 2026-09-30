import * as Sentry from '@sentry/node';
import { flushErrorReporting, initErrorReporting, reportError } from './error-reporter.js';

vi.mock('@sentry/node', () => ({ init: vi.fn(), captureException: vi.fn(), close: vi.fn().mockResolvedValue(true) }));

describe('error reporter', () => {
  it('does nothing until a DSN is configured', () => {
    expect(initErrorReporting({ dsn: undefined, environment: 'production' })).toBe(false);
    reportError(new Error('x'), { area: 'payments' });
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('starts Sentry with a scrubber, then tags and forwards errors', async () => {
    expect(initErrorReporting({ dsn: 'https://k@o0.ingest.sentry.io/1', environment: 'staging', release: 'abc123' })).toBe(true);
    const opts = vi.mocked(Sentry.init).mock.calls[0]![0]!;
    expect(opts).toMatchObject({ environment: 'staging', release: 'abc123' });
    const scrubbed = opts.beforeSend!({ request: { data: '{"card":1}', cookies: { a: 'b' }, headers: { authorization: 'x' }, query_string: 'phone=1', url: '/x' } } as never, {} as never) as unknown as { request: Record<string, unknown> };
    expect(scrubbed.request).toEqual({ url: '/x' });

    reportError(new Error('boom'), { area: 'refunds', extra: { refundJobId: 'j1' } });
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }), { tags: { area: 'refunds' }, extra: { refundJobId: 'j1' } });
    reportError('plain string', { area: 'http' });
    expect(vi.mocked(Sentry.captureException).mock.calls[1]![0]).toBeInstanceOf(Error);

    await flushErrorReporting();
    expect(Sentry.close).toHaveBeenCalled();
  });

  it('never throws even when the SDK does', () => {
    vi.mocked(Sentry.captureException).mockImplementationOnce(() => {
      throw new Error('sdk down');
    });
    expect(() => reportError(new Error('x'), { area: 'jobs' })).not.toThrow();
  });
});
