import { defineConfig } from '@playwright/test';
import 'dotenv/config';
import { baseURL } from './src/config';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // 900 req/min per IP is shared across the whole suite; keep worker count modest
  // so a full local run never gets near the limit.
  workers: process.env.CI ? 4 : 6,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['./src/reporters/failuresOnly.ts'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    extraHTTPHeaders: { Accept: 'application/json' },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'free-api' }],
});
