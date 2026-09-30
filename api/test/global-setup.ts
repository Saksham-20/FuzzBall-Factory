import { spawnSync } from 'node:child_process';

/** Database name (last path segment) of a postgres connection string, or undefined if it isn't parseable. */
export function databaseName(url: string): string | undefined {
  try {
    const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
    return name || undefined;
  } catch {
    return undefined;
  }
}

/** Throws unless `url` points at a database whose name ends in `_test`. */
export function assertTestDatabase(url: string | undefined): asserts url is string {
  const name = url ? databaseName(url) : undefined;
  if (!url || !name || !name.endsWith('_test')) {
    throw new Error(
      [
        'Refusing to run e2e tests: the target database is not a test database.',
        `  database: ${name ?? '(none)'}`,
        '  The suite creates and edits real rows, so it only runs against a database whose name ends in "_test".',
        '  Set TEST_DATABASE_URL (in api/.env or the shell), e.g.:',
        '    createdb fuzzball_test',
        '    TEST_DATABASE_URL=postgresql://USER@localhost:5432/fuzzball_test',
      ].join('\n'),
    );
  }
}

/** Vitest globalSetup for the e2e config: pick the test DB, refuse anything else, bring its schema and seed data up to date. */
export default function setup() {
  // Real environment wins over files (loadEnvFile never overrides), so CI can inject everything.
  try {
    process.loadEnvFile('.env');
  } catch {
    // No .env file: rely on the real environment.
  }
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  assertTestDatabase(url);
  // Workers are spawned after this and inherit it; Nest's ConfigModule lets process.env beat .env values.
  process.env.DATABASE_URL = url;

  // Tests build their own products and users, but they borrow the seeded categories and shop settings.
  for (const args of [['prisma', 'migrate', 'deploy'], ['prisma', 'db', 'seed']]) {
    const run = spawnSync('npx', args, { env: process.env, encoding: 'utf8', shell: process.platform === 'win32' });
    if (run.status !== 0) {
      throw new Error(`npx ${args.join(' ')} failed on the test database:\n${run.stdout}\n${run.stderr}`);
    }
  }
}
