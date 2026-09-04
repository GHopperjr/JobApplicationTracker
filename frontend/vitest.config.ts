import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // e2e/ holds Playwright specs, which import their own `test`/`expect`
    // from @playwright/test — picking them up here collides with vitest's
    // globals (see playwright.config.ts for that suite's own runner).
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: { reporter: ['text', 'lcov'], exclude: ['src/types/database.types.ts'] },
  },
});
