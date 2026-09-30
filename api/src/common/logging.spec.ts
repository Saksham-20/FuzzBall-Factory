import { Writable } from 'node:stream';
import pino from 'pino';
import { loggerParams, pathOnly, REDACT_PATHS, requestId } from './logging.js';

function fakeRes() {
  const headers: Record<string, string> = {};
  return { headers, res: { setHeader: (k: string, v: string) => void (headers[k] = v) } };
}

describe('requestId', () => {
  it('keeps a sane inbound id and echoes it', () => {
    const { res, headers } = fakeRes();
    expect(requestId({ headers: { 'x-request-id': 'abc12345-def' } } as never, res as never)).toBe('abc12345-def');
    expect(headers['x-request-id']).toBe('abc12345-def');
  });

  it.each(['short', 'has spaces in it', 'x'.repeat(65), 'line\nbreak12345'])('replaces an unusable inbound id (%s)', (bad) => {
    const { res, headers } = fakeRes();
    const id = requestId({ headers: { 'x-request-id': bad } } as never, res as never);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers['x-request-id']).toBe(id);
  });

  it('mints an id when none is sent', () => {
    expect(requestId({ headers: {} } as never, fakeRes().res as never)).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('logging config', () => {
  it('strips the query string from logged urls', () => {
    expect(pathOnly('/orders/track?phone=9876543210&number=FB-1')).toBe('/orders/track');
    expect(pathOnly(undefined)).toBe('');
  });

  it('redacts credentials from a request line', () => {
    const lines: string[] = [];
    const log = pino({ redact: { paths: REDACT_PATHS, censor: '[redacted]' } }, new Writable({ write: (c, _e, cb) => (lines.push(String(c)), cb()) }));
    log.info({ req: { headers: { authorization: 'Bearer secret-jwt', cookie: 'fb_refresh=secret', 'x-razorpay-signature': 'sig', accept: 'json' } }, res: { headers: { 'set-cookie': ['fb_access=secret'] } } }, 'hit');
    const out = lines.join('');
    expect(out).not.toMatch(/secret|"sig"/);
    expect(out).toContain('json');
  });

  it('is quiet under test, pretty only in development, JSON in production', () => {
    expect(loggerParams({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }).pinoHttp).toMatchObject({ level: 'silent', transport: undefined });
    expect(loggerParams({ NODE_ENV: 'production', LOG_LEVEL: 'info' }).pinoHttp).toMatchObject({ transport: undefined });
    expect(loggerParams({ NODE_ENV: 'development', LOG_LEVEL: 'debug' }).pinoHttp).toMatchObject({ transport: { target: 'pino-pretty' } });
  });
});
