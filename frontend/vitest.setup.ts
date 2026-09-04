import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Must be set before any module that reads them (e.g. supabaseClient.ts) is imported.
vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

// jsdom implements neither of these, and both are used by real components.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

if (!('randomUUID' in crypto)) {
  Object.defineProperty(crypto, 'randomUUID', { value: () => 'test-uuid' });
}

afterEach(() => {
  cleanup();
  localStorage.clear(); // the stale threshold persists here — leaking it cross-test is a real flake
});
