import { defineConfig, devices } from "@playwright/test";

const PORT = 3310;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Layout checks measure resting positions: no entrance animations, no swinging tickets.
    reducedMotion: "reduce",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // A production build in its own dist dir, on its own port, so it never touches the `.next`
    // a running `next start` serves. Mock data, whatever a local .env says.
    command: `npx next build && npx next start -p ${PORT}`,
    env: { NEXT_DIST_DIR: ".next-e2e", NEXT_PUBLIC_USE_MOCK: "true" },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
