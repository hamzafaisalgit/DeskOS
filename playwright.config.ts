import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    channel: "chrome",
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173",
    viewport: { width: 1366, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm.cmd run dev -- --host 127.0.0.1",
    url: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
