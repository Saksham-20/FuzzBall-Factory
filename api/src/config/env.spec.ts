import { validateEnv } from './env.js';

const valid = {
  DATABASE_URL: 'postgresql://u@localhost:5432/fuzzball',
  JWT_ACCESS_SECRET: 'a'.repeat(24),
  JWT_REFRESH_SECRET: 'b'.repeat(24),
};

describe('validateEnv', () => {
  it('applies defaults', () => {
    const env = validateEnv(valid);
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.WEB_ORIGIN).toBe('http://localhost:3000');
    expect(env.ACCESS_TTL_MINUTES).toBe(15);
    expect(env.REFRESH_TTL_DAYS).toBe(30);
    expect(env.TRUST_PROXY).toBe(0);
  });

  it('coerces numeric strings and treats empty values as unset', () => {
    const env = validateEnv({ ...valid, PORT: '5050', RESEND_API_KEY: '', CLOUDINARY_URL: '', ADMIN_EMAIL: '', COOKIE_DOMAIN: '' });
    expect(env.PORT).toBe(5050);
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.CLOUDINARY_URL).toBeUndefined();
    expect(env.ADMIN_EMAIL).toBeUndefined();
    expect(env.COOKIE_DOMAIN).toBeUndefined();
  });

  it('lists every problem in one error', () => {
    expect(() => validateEnv({ JWT_ACCESS_SECRET: 'short' })).toThrowError(/DATABASE_URL[\s\S]*JWT_ACCESS_SECRET[\s\S]*JWT_REFRESH_SECRET/);
  });

  it('rejects an unknown NODE_ENV and a non-numeric PORT', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: 'staging' })).toThrowError(/NODE_ENV/);
    expect(() => validateEnv({ ...valid, PORT: 'abc' })).toThrowError(/PORT/);
  });

  it('production refuses placeholder or identical secrets', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: 'production' })).toThrowError(/32\+ characters/);
    const long = { ...valid, NODE_ENV: 'production', JWT_ACCESS_SECRET: 'x'.repeat(40), JWT_REFRESH_SECRET: 'x'.repeat(40) };
    expect(() => validateEnv(long)).toThrowError(/must differ/);
    expect(() => validateEnv({ ...long, JWT_REFRESH_SECRET: 'y'.repeat(40) })).not.toThrow();
    expect(() => validateEnv({ ...long, JWT_REFRESH_SECRET: 'change-me-change-me-change-me-please' })).toThrowError(/32\+ characters/);
  });

  it('validates the admin email when provided', () => {
    expect(() => validateEnv({ ...valid, ADMIN_EMAIL: 'nope' })).toThrowError(/ADMIN_EMAIL/);
  });
});
