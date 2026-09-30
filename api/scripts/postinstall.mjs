// Generates the Prisma client after `npm install`, but only where the Prisma CLI exists.
// Production servers install with `--omit=dev` (no CLI, and none needed: the client is compiled into dist/ by the
// build). Developers and CI have the CLI and get a fresh client.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (!existsSync(new URL('../node_modules/.bin/prisma', import.meta.url))) {
  console.log('postinstall: prisma CLI not installed (production install), skipping `prisma generate`.');
  process.exit(0);
}
const run = spawnSync('npx', ['prisma', 'generate'], { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(run.status ?? 1);
