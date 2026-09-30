import { secretWarnings, validateEnv } from './env.js';

const valid = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://u@localhost:5432/fuzzball',
  JWT_ACCESS_SECRET: 'a'.repeat(24),
  JWT_REFRESH_SECRET: 'b'.repeat(24),
};

/** A complete, valid production environment for live payments; tests knock single values out of it. */
const live = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u@localhost:5432/fuzzball',
  JWT_ACCESS_SECRET: 'x'.repeat(40),
  JWT_REFRESH_SECRET: 'y'.repeat(40),
  WEB_ORIGIN: 'https://shop.example',
  TRUST_PROXY: '1',
  PAYMENTS_MODE: 'razorpay',
  RAZORPAY_KEY_ID: 'rzp_live_1',
  RAZORPAY_KEY_SECRET: 'secret',
  RAZORPAY_WEBHOOK_SECRET: 'whsec',
  CLOUDINARY_URL: 'cloudinary://k:s@cloud',
  RESEND_API_KEY: 're_123',
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
    expect(env.HOST).toBe('0.0.0.0');
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.PAYMENTS_MODE).toBe('mock');
  });

  it('coerces numeric strings and treats empty values as unset', () => {
    const env = validateEnv({ ...valid, PORT: '5050', TRUST_PROXY: '2', RESEND_API_KEY: '', CLOUDINARY_URL: '', ADMIN_EMAIL: '', COOKIE_DOMAIN: '', HOST: '', COOKIE_SECURE: '', PAYMENTS_MODE: '' });
    expect(env.PORT).toBe(5050);
    expect(env.TRUST_PROXY).toBe(2);
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.CLOUDINARY_URL).toBeUndefined();
    expect(env.ADMIN_EMAIL).toBeUndefined();
    expect(env.COOKIE_DOMAIN).toBeUndefined();
    expect(env.HOST).toBe('0.0.0.0');
    expect(env.PAYMENTS_MODE).toBe('mock');
  });

  it('lists every problem in one error', () => {
    expect(() => validateEnv({ JWT_ACCESS_SECRET: 'short' })).toThrowError(/DATABASE_URL[\s\S]*JWT_ACCESS_SECRET[\s\S]*JWT_REFRESH_SECRET/);
  });

  it('requires NODE_ENV: no silent "development"', () => {
    const { NODE_ENV: _omitted, ...withoutNodeEnv } = valid;
    expect(() => validateEnv(withoutNodeEnv)).toThrowError(/NODE_ENV must be set/);
    expect(() => validateEnv({ ...valid, NODE_ENV: '' })).toThrowError(/NODE_ENV must be set/);
  });

  it('rejects an unknown NODE_ENV and a non-numeric PORT', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: 'staging' })).toThrowError(/NODE_ENV/);
    expect(() => validateEnv({ ...valid, PORT: 'abc' })).toThrowError(/PORT/);
  });

  it('validates the admin email when provided', () => {
    expect(() => validateEnv({ ...valid, ADMIN_EMAIL: 'nope' })).toThrowError(/ADMIN_EMAIL/);
  });
});

describe('validateEnv payments mode', () => {
  it('defaults to razorpay when keys are set outside production, else mock', () => {
    expect(validateEnv({ ...valid, RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's' }).PAYMENTS_MODE).toBe('razorpay');
    expect(validateEnv({ ...valid, RAZORPAY_KEY_ID: 'k' }).PAYMENTS_MODE).toBe('mock');
  });

  it('razorpay mode needs both keys in every environment', () => {
    expect(() => validateEnv({ ...valid, PAYMENTS_MODE: 'razorpay' })).toThrowError(/RAZORPAY_KEY_ID[\s\S]*RAZORPAY_KEY_SECRET/);
    expect(() => validateEnv({ ...valid, PAYMENTS_MODE: 'razorpay', RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's' })).not.toThrow();
  });

  it('rejects an unknown PAYMENTS_MODE', () => {
    expect(() => validateEnv({ ...valid, PAYMENTS_MODE: 'live' })).toThrowError(/PAYMENTS_MODE/);
  });
});

describe('validateEnv in production', () => {
  it('accepts a complete live configuration and applies production defaults', () => {
    const env = validateEnv(live);
    expect(env.PAYMENTS_MODE).toBe('razorpay');
    expect(env.HOST).toBe('127.0.0.1');
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.TRUST_PROXY).toBe(1);
    expect(env.WEB_ORIGIN).toBe('https://shop.example');
  });

  it('refuses placeholder or identical secrets', () => {
    expect(() => validateEnv({ ...live, JWT_ACCESS_SECRET: 'a'.repeat(24), JWT_REFRESH_SECRET: 'b'.repeat(24) })).toThrowError(/32\+ characters/);
    expect(() => validateEnv({ ...live, JWT_REFRESH_SECRET: live.JWT_ACCESS_SECRET })).toThrowError(/must differ/);
    expect(() => validateEnv({ ...live, JWT_REFRESH_SECRET: 'change-me-change-me-change-me-please' })).toThrowError(/32\+ characters/);
  });

  it.each(['WEB_ORIGIN', 'TRUST_PROXY', 'PAYMENTS_MODE'])('requires %s to be chosen explicitly', (key) => {
    expect(() => validateEnv({ ...live, [key]: undefined })).toThrowError(new RegExp(`${key} must be set`));
    expect(() => validateEnv({ ...live, [key]: '' })).toThrowError(new RegExp(`${key} must be set`));
  });

  it('accepts TRUST_PROXY=0 as an explicit choice', () => {
    expect(validateEnv({ ...live, TRUST_PROXY: '0' }).TRUST_PROXY).toBe(0);
  });

  it.each(['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'CLOUDINARY_URL', 'RESEND_API_KEY'])('live payments require %s', (key) => {
    expect(() => validateEnv({ ...live, [key]: undefined })).toThrowError(new RegExp(key));
  });

  it('refuses COOKIE_SECURE=false with live payments but allows it for a mock staging box', () => {
    expect(() => validateEnv({ ...live, COOKIE_SECURE: 'false' })).toThrowError(/COOKIE_SECURE=false is not allowed/);
    const staging = {
      NODE_ENV: 'production',
      DATABASE_URL: live.DATABASE_URL,
      JWT_ACCESS_SECRET: live.JWT_ACCESS_SECRET,
      JWT_REFRESH_SECRET: live.JWT_REFRESH_SECRET,
      WEB_ORIGIN: 'http://203.0.113.5',
      TRUST_PROXY: '1',
      PAYMENTS_MODE: 'mock',
      COOKIE_SECURE: 'false',
    };
    const env = validateEnv(staging);
    expect(env.PAYMENTS_MODE).toBe('mock');
    expect(env.COOKIE_SECURE).toBe(false);
  });

  it('refuses mock payments next to Razorpay keys', () => {
    expect(() => validateEnv({ ...live, PAYMENTS_MODE: 'mock' })).toThrowError(/ambiguous/);
  });
});

describe('secretWarnings', () => {
  it('flags short or placeholder secrets in development only', () => {
    const weak = { JWT_ACCESS_SECRET: 'change-me', JWT_REFRESH_SECRET: 'z'.repeat(40) };
    expect(secretWarnings({ NODE_ENV: 'development', ...weak })).toHaveLength(1);
    expect(secretWarnings({ NODE_ENV: 'development', JWT_ACCESS_SECRET: 'z'.repeat(40), JWT_REFRESH_SECRET: 'w'.repeat(40) })).toHaveLength(0);
    expect(secretWarnings({ NODE_ENV: 'test', ...weak })).toHaveLength(0);
  });
});
