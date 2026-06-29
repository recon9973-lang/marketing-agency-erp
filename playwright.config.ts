import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "ALLOW_DEV_SESSION=true pnpm dev --hostname 127.0.0.1 --port 63830",
    url: "http://127.0.0.1:63830",
    reuseExistingServer: true
  },
  use: {
    baseURL: "http://127.0.0.1:63830",
    trace: "on-first-retry"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chrome" } }]
});
