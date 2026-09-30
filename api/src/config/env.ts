import { Logger } from '@nestjs/common';
import { z } from 'zod';

/** Treat `KEY=` (empty) in .env the same as "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const positiveInt = (fallback: number) =>
  z.preprocess((v) => (v === '' || v === undefined ? fallback : v), z.coerce.number().int().positive());

/** `true` / `false` strings; empty or missing = not set. */
const flag = z.preprocess(
  (v) => (v === '' || v === undefined ? undefined : v === 'true' ? true : v === 'false' ? false : v),
  z.boolean().optional(),
);

const rawSchema = z.object({
  /** Required, no default: an unset NODE_ENV must never silently mean "development" on a server. */
  NODE_ENV: z.enum(['development', 'test', 'production'], { error: 'NODE_ENV must be set to development, test or production' }),
  PORT: positiveInt(4000),
  /** Comma-separated list of allowed browser origins. Required in production; defaults to http://localhost:3000 elsewhere. */
  WEB_ORIGIN: optional(z.string().min(1)),
  /** Number of reverse-proxy hops to trust for `req.ip` (0 = none). Required in production; defaults to 0 elsewhere. */
  TRUST_PROXY: optional(z.coerce.number().int().min(0)),
  /** Bind address. Defaults to 127.0.0.1 in production (behind a reverse proxy) and 0.0.0.0 elsewhere. */
  HOST: optional(z.string().min(1)),
  /** pino level. Defaults to info in production, debug in development, silent under test. */
  LOG_LEVEL: optional(z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** Connections in the Prisma pool. Keep (instances x this) under Postgres `max_connections`. */
  DB_POOL_MAX: positiveInt(10),
  /** A statement running longer than this is cancelled by Postgres. */
  DB_STATEMENT_TIMEOUT_MS: positiveInt(15_000),
  /**
   * A transaction left idle this long is killed. Must stay above the longest scheduled job (JobRunner holds its
   * advisory-lock transaction idle while the job works on other connections: 5 minutes by default).
   */
  DB_IDLE_TX_TIMEOUT_MS: positiveInt(6 * 60_000),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  ACCESS_TTL_MINUTES: positiveInt(15),
  REFRESH_TTL_DAYS: positiveInt(30),
  /** Only set when web and api live on different subdomains of one site. */
  COOKIE_DOMAIN: optional(z.string()),
  /**
   * `Secure` flag on auth cookies. Defaults to true in production and false elsewhere. Set `false` only for a
   * staging box that has no HTTPS yet: it is refused together with live payments.
   */
  COOKIE_SECURE: flag,

  ADMIN_EMAIL: optional(z.string().email()),
  ADMIN_PASSWORD: optional(z.string().min(8)),

  /**
   * `razorpay` = real payments (needs the Razorpay keys); `mock` = simulated "test payment" (never touches Razorpay,
   * even if keys are set). Required in production. Elsewhere it defaults to `razorpay` when keys are set, else `mock`.
   */
  PAYMENTS_MODE: optional(z.enum(['mock', 'razorpay'])),
  RAZORPAY_KEY_ID: optional(z.string()),
  RAZORPAY_KEY_SECRET: optional(z.string()),
  RAZORPAY_WEBHOOK_SECRET: optional(z.string()),

  CLOUDINARY_URL: optional(z.string()),
  /** Public base URL of this API, used to build absolute URLs for locally stored uploads (default http://localhost:PORT). */
  API_PUBLIC_URL: optional(z.string().url()),
  /** Where the local-disk upload driver writes (default ./uploads). */
  UPLOADS_DIR: optional(z.string()),

  RESEND_API_KEY: optional(z.string()),
  MAIL_FROM: z.string().min(1).default('FuzzBall Factory <hello@fuzzballfactory.example>'),

  /** Where the contact form's messages are sent. Falls back to ADMIN_EMAIL; with neither, the form answers 503. */
  CONTACT_INBOX_EMAIL: optional(z.string().email()),

  WHATSAPP_NUMBER: optional(z.string()),

  /** Error tracking. Unset = off. Failed refunds, payment mismatches, job crashes and unexpected 500s are sent. */
  SENTRY_DSN: optional(z.string().url()),
  /** Defaults to NODE_ENV. Set `staging` on a production-mode staging box so it does not page as production. */
  SENTRY_ENVIRONMENT: optional(z.string()),
  /** Git sha of the deployed build, set by the deploy script. */
  SENTRY_RELEASE: optional(z.string()),
});

type Raw = z.infer<typeof rawSchema>;

/** The payments mode this environment resolves to, or undefined when production forgot to choose one. */
function resolvePaymentsMode(env: Raw): 'mock' | 'razorpay' | undefined {
  if (env.PAYMENTS_MODE) return env.PAYMENTS_MODE;
  if (env.NODE_ENV === 'production') return undefined;
  return env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET ? 'razorpay' : 'mock';
}

export const envSchema = rawSchema
  .superRefine((env, ctx) => {
    const problem = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    const production = env.NODE_ENV === 'production';
    const mode = resolvePaymentsMode(env);

    if (production) {
      // Production must not run on placeholder secrets.
      for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
        if (env[key].length < 32 || /change-me/i.test(env[key])) problem(key, `${key} must be a random string of 32+ characters in production`);
      }
      if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) problem('JWT_REFRESH_SECRET', 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET');
      // Values whose dev defaults are wrong on a real server must be chosen on purpose.
      if (!env.WEB_ORIGIN) problem('WEB_ORIGIN', 'WEB_ORIGIN must be set in production (comma-separated browser origins)');
      if (env.TRUST_PROXY === undefined) problem('TRUST_PROXY', 'TRUST_PROXY must be set in production (proxy hops in front of the API, e.g. 1 behind nginx, 0 for none)');
      if (!mode) problem('PAYMENTS_MODE', 'PAYMENTS_MODE must be set to "razorpay" or "mock" in production');
    }

    if (mode === 'razorpay') {
      if (!env.RAZORPAY_KEY_ID) problem('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_ID is required when PAYMENTS_MODE=razorpay');
      if (!env.RAZORPAY_KEY_SECRET) problem('RAZORPAY_KEY_SECRET', 'RAZORPAY_KEY_SECRET is required when PAYMENTS_MODE=razorpay');
      if (production) {
        if (!env.RAZORPAY_WEBHOOK_SECRET) problem('RAZORPAY_WEBHOOK_SECRET', 'RAZORPAY_WEBHOOK_SECRET is required for live payments in production');
        if (!env.CLOUDINARY_URL) problem('CLOUDINARY_URL', 'CLOUDINARY_URL is required for live payments in production (uploads must not sit on local disk)');
        if (!env.RESEND_API_KEY) problem('RESEND_API_KEY', 'RESEND_API_KEY is required for live payments in production (order and password-reset emails)');
        if (env.COOKIE_SECURE === false) problem('COOKIE_SECURE', 'COOKIE_SECURE=false is not allowed with live payments: serve the site over HTTPS');
      }
    }

    if (production && mode === 'mock' && env.RAZORPAY_KEY_ID) {
      problem('PAYMENTS_MODE', 'PAYMENTS_MODE=mock with Razorpay keys set in production is ambiguous: unset the keys, or use PAYMENTS_MODE=razorpay');
    }
  })
  .transform((env) => ({
    ...env,
    WEB_ORIGIN: env.WEB_ORIGIN ?? 'http://localhost:3000',
    TRUST_PROXY: env.TRUST_PROXY ?? 0,
    LOG_LEVEL: env.LOG_LEVEL ?? (env.NODE_ENV === 'production' ? 'info' : env.NODE_ENV === 'test' ? 'silent' : 'debug'),
    HOST: env.HOST ?? (env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0'),
    COOKIE_SECURE: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
    // Never undefined here: superRefine already rejected a production env without a mode.
    PAYMENTS_MODE: resolvePaymentsMode(env) ?? ('mock' as const),
  }));

export type Env = z.infer<typeof envSchema>;

/** Weak-looking secrets that production refuses outright: warn about them in development (tests stay quiet). */
export function secretWarnings(env: Pick<Env, 'NODE_ENV' | 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'>): string[] {
  if (env.NODE_ENV !== 'development') return [];
  const warnings: string[] = [];
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    if (env[key].length < 32 || /change-me/i.test(env[key])) {
      warnings.push(`${key} is short or a placeholder: fine on your laptop, never on a server anyone can reach`);
    }
  }
  return warnings;
}

/** Used as the `validate` option of `ConfigModule.forRoot`. Throws one readable error listing every problem. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(env)'}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  const logger = new Logger('Config');
  for (const warning of secretWarnings(parsed.data)) logger.warn(warning);
  return parsed.data;
}

export const isProduction = (env: Pick<Env, 'NODE_ENV'>) => env.NODE_ENV === 'production';
