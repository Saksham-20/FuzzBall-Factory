import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    // Unit tests sit beside their module. Browser specs live in e2e/ and run under Playwright.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
