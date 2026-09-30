import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Refuses any database not named *_test, then migrates it (see test/global-setup.ts).
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup-http.ts'],
    // Every file shares the one test database (and the dashboard test counts rows): run files one at a time.
    fileParallelism: false,
  },
});
