import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';
import { baseURL, uiBaseUrl } from './src/config';

// A fresh, cookie-less visit to `uiBaseUrl` lands on a login/landing page, not the
// dashboard — the anonymous web client still expects a session (see README "Browser
// UI tests: session"). Never committed (see .gitignore); each developer generates
// their own with:
//   npx playwright codegen --save-storage=ui-tests/.auth/storageState.json <UI_BASE_URL>
const UI_STORAGE_STATE_PATH = 'ui-tests/.auth/storageState.json';
const uiStorageState = existsSync(UI_STORAGE_STATE_PATH) ? UI_STORAGE_STATE_PATH : undefined;

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // 900 req/min per IP is shared across the whole suite; keep worker count modest
  // so a full local run never gets near the limit.
  workers: process.env.CI ? 4 : 6,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['./src/reporters/failuresOnly.ts'], ['./src/reporters/htmlReport.ts']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'free-api',
      testDir: './tests',
      use: {
        baseURL,
        extraHTTPHeaders: { Accept: 'application/json' },
      },
    },
    {
      name: 'browser-ui',
      testDir: './ui-tests',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: uiBaseUrl,
        storageState: uiStorageState,
        // Always visible, not headless: this project is small and meant to be
        // watched, not run unattended in CI (which can't reach the site anyway —
        // see README "CI").
        headless: false,
      },
    },
  ],
});
