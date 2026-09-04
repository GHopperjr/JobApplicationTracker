import { execSync } from 'node:child_process';

// Resets the local Supabase instance to a known state (every migration
// replayed, then seed.sql) before the suite runs — E2E must start from the
// same three seeded applications every time, or assertions on row counts and
// specific companies become flaky (docs/08-testing-and-ci.md).
export default async function globalSetup() {
  execSync('npx supabase db reset --local', {
    cwd: '../backend',
    stdio: 'inherit',
  });
}
