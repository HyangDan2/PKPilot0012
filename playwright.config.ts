import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PK12_BASE ?? 'http://127.0.0.1:4173/PKPilot0012/';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: '.playwright-artifacts',
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Set PK12_BASE to check an already-running site (the deployed Pages URL).
  webServer: process.env.PK12_BASE
    ? undefined
    : {
        command: 'npm run build && npm run preview',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
