import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8080", trace: "on-first-retry", video: "off" },
  webServer: { command: "node node_modules/vite/bin/vite.js --host 127.0.0.1", url: "http://127.0.0.1:8080", reuseExistingServer: true },
  projects: [{
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      launchOptions: process.env.PLAYWRIGHT_CHROME_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } : undefined,
      permissions: ["camera", "microphone"],
    },
  }],
});
