import { originCheck, parseOrigins } from './origin-check.js';

const run = (method: string, origin: string | undefined, allowed = ['https://shop.example']) => {
  let status: number | undefined;
  let body: unknown;
  let nexted = false;
  originCheck(allowed)(
    { method, headers: origin === undefined ? {} : { origin } } as never,
    { status: (s: number) => ((status = s), { json: (b: unknown) => (body = b) }) } as never,
    () => (nexted = true),
  );
  return { status, body, nexted };
};

describe('originCheck', () => {
  it('parses the configured list like CORS does', () => {
    expect(parseOrigins('https://a.com/, https://b.com ,')).toEqual(['https://a.com', 'https://b.com']);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('refuses a %s from another site', (m) => {
    const r = run(m, 'https://evil.example');
    expect(r).toMatchObject({ status: 403, nexted: false, body: { code: 'FORBIDDEN' } });
  });

  it('refuses an Origin of "null" (sandboxed frames, some redirects) and lookalikes', () => {
    expect(run('POST', 'null').status).toBe(403);
    expect(run('POST', 'https://shop.example.evil.com').status).toBe(403);
    expect(run('POST', 'http://shop.example').status).toBe(403); // wrong scheme
  });

  it('lets our own site through, and any configured extra origin', () => {
    expect(run('POST', 'https://shop.example').nexted).toBe(true);
    expect(run('DELETE', 'https://www.shop.example', ['https://shop.example', 'https://www.shop.example']).nexted).toBe(true);
  });

  it('lets requests without an Origin through (webhooks, curl) and never checks reads', () => {
    expect(run('POST', undefined).nexted).toBe(true);
    expect(run('GET', 'https://evil.example').nexted).toBe(true);
    expect(run('OPTIONS', 'https://evil.example').nexted).toBe(true);
  });
});
