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
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // 로컬은 설치된 Chrome을 사용하고, Chrome이 없는 CI/컨테이너에서는
        // PLAYWRIGHT_CHROMIUM_EXECUTABLE로 미리 설치된 Chromium 경로를 지정한다.
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } }
          : { channel: "chrome" })
      }
    }
  ]
});
