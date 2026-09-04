# 08 — Testing & CI

## Testing strategy

Four layers, each testing something the others cannot. The guiding rule throughout, carried from the
reference project: **test what a user does, not how the code does it.** Query by role and text, not
by test id; assert on rendered output, not internal state.

| Layer | Tool | What it covers | Roughly |
|---|---|---|---|
| Unit | Vitest | Pure logic: `isStale`, CSV coercion, format helpers, `toAppError` mapping | ~30% |
| Service | Vitest + mocked client | Query shape, filter construction, error normalization | ~15% |
| Component / hook | Vitest + RTL | Rendering, interaction, optimistic update + rollback | ~45% |
| End-to-end | Playwright | The critical paths, against a real database | ~10% |

Coverage targets are a sanity check, not a gate to game. **The specific behaviors listed under
"Non-negotiable tests" below matter far more than any percentage.**

---

## Test environment setup

The service layer imports `supabaseClient.ts`, which **throws at module load** when env vars are
missing ([02](./02-backend-architecture.md)). Every service test fails on first run until this is
handled — solve it once, in setup:

```ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest';
import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Must be set before any module that reads them is imported.
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
  localStorage.clear();   // the stale threshold persists here — leaking it cross-test is a real flake
});
```

```ts
// vitest.config.ts
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: { reporter: ['text', 'lcov'], exclude: ['src/types/database.types.ts'] },
  },
});
```

`database.types.ts` is excluded from coverage — it is generated, and measuring coverage of type
declarations is meaningless.

### The shared render helper

Almost every component test needs a `QueryClientProvider`. Write it once:

```tsx
// src/test/renderWithProviders.tsx
export function renderWithProviders(ui: ReactElement, { route = '/applications' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },   // retry:false — a failing test should fail fast
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <ToastProvider>{ui}</ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    ),
  };
}
```

`retry: false` is essential. With the production default of `retry: 1`, a test asserting an error
state waits through a retry cycle and intermittently times out.

---

## Non-negotiable tests

These cover behaviors that are invisible in manual happy-path testing and expensive to discover in
production. If time is short, these are the ones that get written.

1. **Optimistic status change rolls back on failure.** Reject the mutation; assert the card returns
   to its original column and an error toast appears. Without this, a failed save silently leaves
   the user believing a change was recorded.

2. **`changeStatus` does not throw when a detail query is cached.** Populate
   `queryKeys.applications.detail(id)` with a single object, then run the mutation. This is a
   regression test for the `setQueriesData` prefix-matching bug ([03](./03-frontend-architecture.md))
   — with a wrong key, `onMutate` throws before the mutation fires.

3. **Bulk status change rolls back as one unit.** Reject it; assert *all* selected rows revert.

4. **Sign-out clears the query cache.** Assert `queryClient.getQueryData` is empty afterward. This
   is the cross-user data leak in [05](./05-features-and-workflows.md) F1.

5. **Empty optional fields become `null`, not `''`.** Submit the form with a blank job link; assert
   the service received `job_link: null`. Without this, every application saved without a link fails
   the check constraint.

6. **URL filter values are validated, not cast.** Render at `?status=bogus`; assert it is dropped
   rather than passed to the query.

7. **`isStale` excludes terminal statuses.** A Rejected application untouched for a year is not
   stale.

8. **`applied_date` renders as the same calendar day it was stored.** Run with `TZ=Asia/Manila` and
   `TZ=America/Los_Angeles`; `2026-09-01` must render as Sep 1 in both. Catches the UTC-midnight trap
   ([07](./07-component-specifications.md)).

9. **CSV round trip.** Export applications, re-import the produced file, assert statuses and
   platforms survive the label↔enum mapping in both directions.

10. **Import partial failure reports an honest count.** Fail chunk 2 of 3; assert the message says
    100 of 240 and offers a retry.

---

## End-to-end tests (Playwright)

### Why E2E exists here at all

`@dnd-kit` pointer-drag behavior cannot be meaningfully verified in jsdom — there is no layout, so
collision detection has nothing to work with. The board's central interaction is therefore
**untestable below the E2E layer.** That is the entire justification for this suite, and it stays
small on purpose.

```
npm i -D @playwright/test
npx playwright install --with-deps chromium
```

### Scope

Five specs. Not a second full test suite — the critical paths only.

| Spec | Path |
|---|---|
| `auth.spec.ts` | Sign in → land on applications → sign out → redirected to login |
| `crud.spec.ts` | Add via modal → appears on board → edit → persists after reload → delete |
| `dnd.spec.ts` | Drag a card between columns → persists after reload → history shows the transition |
| `views.spec.ts` | Toggle Board ⇄ Table → same data both ways; filter → survives reload via URL |
| `import-export.spec.ts` | Export a CSV → re-import it → duplicate detection flags every row |

### Environment

E2E runs against a **local Supabase instance** (`supabase start`, see
[09](./09-operations.md)) — never against the hosted dev project, and never against production.
Global setup resets the database and seeds a known test user:

```ts
// e2e/global-setup.ts
export default async function globalSetup() {
  execSync('supabase db reset --local', { stdio: 'inherit' });   // migrations + seed.sql
}
```

Auth state is captured once and reused, so only `auth.spec.ts` actually signs in through the UI:

```ts
// playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
    },
  ],
});
```

### Drag-and-drop in Playwright

`dragTo()` does not reliably trigger `@dnd-kit`, which listens for pointer events with movement
thresholds. Drive the pointer manually, with an intermediate move:

```ts
const card = page.getByRole('button', { name: /Acme Corporation/ });
const target = page.getByTestId('column-scheduled_for_interview');

await card.hover();
await page.mouse.down();
await page.mouse.move(0, 0);                       // exceeds the 8px activation constraint
await target.hover();
await page.mouse.move(1, 1);                       // a second move so dnd-kit registers the target
await page.mouse.up();

await expect(target.getByText('Acme Corporation')).toBeVisible();
```

The two separate moves are not superstition — a single jump to the destination frequently fails to
register a drag-over, and this is the most common reason a dnd E2E test is flaky.

**Column droppables carry a `data-testid`** (`column-<status>`). This is the one place test ids are
justified: a column is identified by its status enum, not by visible text, and matching on the
translated header would break the moment a label changes.

---

## Accessibility testing

Automated, on every PR — not a one-time Lighthouse pass at the end.

```
npm i -D vitest-axe @axe-core/playwright
```

**Component level** — for every component rendering meaningful UI:

```ts
it('has no accessibility violations', async () => {
  const { container } = renderWithProviders(<ApplicationCard application={mockApplication} />);
  expect(await axe(container)).toHaveNoViolations();
});
```

**Page level**, in E2E:

```ts
const results = await new AxeBuilder({ page }).analyze();
expect(results.violations).toEqual([]);
```

This catches the `text-slate-400` class of regression (2.6:1 contrast) automatically, rather than
relying on someone remembering to check.

**What automation cannot catch**, and therefore stays a manual checklist item per
[06](./06-implementation-roadmap.md) Phase 5: keyboard drag actually moving cards between columns,
focus returning to the trigger after a drawer closes, and whether screen-reader announcements make
sense in sequence.

---

## CI pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true      # a new push supersedes the running job

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck        # tsc --noEmit

      - name: Unit and component tests
        run: npm run test -- --coverage

      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL_DEV }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY_DEV }}

  e2e:
    runs-on: ubuntu-latest
    needs: verify                  # don't spend E2E minutes if the basics fail
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci

      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - name: Start local Supabase
        run: supabase start

      - name: Apply migrations and seed
        run: supabase db reset --local

      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

### Notes on this pipeline

- **`typecheck` is a separate step from `build`.** Vite's build does not typecheck; without an
  explicit `tsc --noEmit`, type errors reach production.
- **E2E runs against local Supabase in CI**, spun up fresh per run. It never touches a hosted
  project, so a failing test can never corrupt real data.
- **Playwright reports upload only on failure** — the artifact is large and useless when green.
- **`concurrency` cancels superseded runs.** Without it, five pushes in ten minutes queue five full
  E2E runs.
- **Migrations are verified implicitly**: `supabase db reset` applies every migration from scratch on
  every CI run, so a broken migration fails CI rather than being discovered at deploy.

### Required status checks

Configure `verify` and `e2e` as required on `main` in branch protection. A green checkmark nobody is
required to wait for is decoration.

### Package scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint . --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:reset": "supabase db reset --local",
    "db:types": "supabase gen types typescript --local > src/types/database.types.ts"
  }
}
```

`--max-warnings 0` — warnings that never fail a build accumulate until nobody reads them.
