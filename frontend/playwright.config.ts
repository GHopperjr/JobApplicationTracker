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
    baseURL: 'http://localhost:5175',
    trace: 'on-first-retry',
  },
  webServer: {
    // A dedicated port and explicit local env vars, always freshly started
    // (never reuseExistingServer): a developer's ambient `npm run dev` on
    // 5173 points at the hosted project, and reusing it here would silently
    // run E2E against real data — exactly what docs/08 forbids.
    command: 'npm run dev -- --port 5175 --strictPort',
    url: 'http://localhost:5175',
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    },
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
