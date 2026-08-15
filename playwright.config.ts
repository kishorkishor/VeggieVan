import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    // In CI the server is started (and waited on) by a dedicated workflow
    // step so it is already running when Playwright begins. Locally, reuse
    // the dev server if one is running, otherwise Playwright starts one.
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
