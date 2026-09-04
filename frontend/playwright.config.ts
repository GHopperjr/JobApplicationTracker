import { defineConfig, devices } from '@playwright/test';

// Runs against a local Supabase instance only (globalSetup below), never the
// hosted dev project or production — a failing E2E run can never corrupt
// real data (docs/08-testing-and-ci.md).
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // All specs share ONE local database, reset once for the whole run — two
  // spec files racing writes against the same seeded rows would be flaky in
  // a way that has nothing to do with the app itself. The suite is five
  // specs; serial execution costs little.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
    },
  ],
});
