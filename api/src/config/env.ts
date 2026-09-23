import { z } from 'zod';

/** Treat `KEY=` (empty) in .env the same as "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const positiveInt = (fallback: number) =>
  z.preprocess((v) => (v === '' || v === undefined ? fallback : v), z.coerce.number().int().positive());

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: positiveInt(4000),
    /** Comma-separated list of allowed browser origins. */
    WEB_ORIGIN: z.string().min(1).default('http://localhost:3000'),
    /** Number of reverse-proxy hops to trust for `req.ip` (0 = none). */
    TRUST_PROXY: z.preprocess((v) => (v === '' || v === undefined ? 0 : v), z.coerce.number().int().min(0)),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
    JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
    ACCESS_TTL_MINUTES: positiveInt(15),
    REFRESH_TTL_DAYS: positiveInt(30),
    /** Only set when web and api live on different subdomains of one site. */
    COOKIE_DOMAIN: optional(z.string()),

    ADMIN_EMAIL: optional(z.string().email()),
    ADMIN_PASSWORD: optional(z.string().min(8)),

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

    WHATSAPP_NUMBER: optional(z.string()),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    // Production must not run on placeholder secrets.
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      if (env[key].length < 32 || /change-me/i.test(env[key])) {
        ctx.addIssue({ code: 'custom', path: [key], message: `${key} must be a random string of 32+ characters in production` });
      }
    }
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['JWT_REFRESH_SECRET'], message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET' });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Used as the `validate` option of `ConfigModule.forRoot`. Throws one readable error listing every problem. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(env)'}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return parsed.data;
}

export const isProduction = (env: Pick<Env, 'NODE_ENV'>) => env.NODE_ENV === 'production';
