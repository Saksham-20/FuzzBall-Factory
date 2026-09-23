import { defineConfig } from 'prisma/config';

// Prisma 7 no longer loads .env on its own. Node >= 20.12 can do it natively.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: rely on the real environment (CI, production).
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'jiti prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
