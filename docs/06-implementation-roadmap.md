# 06 — Implementation Roadmap

## How to use this document

Nine phases, ordered so that **the app works end to end at the close of every phase** — never a
state where three layers are half-built and nothing runs. Each phase lists what to build, what
"done" means, and the specific traps worth knowing before you hit them.

Phases 0–3 produce a genuinely usable tracker. Phases 4–6 make it production-ready. Phases 7–8 add
the lifecycle and data-portability features that make it something a person will still be using
three months into a job search.

**If you need to cut scope, cut from the end.** Phase 7's archive and stale detection are genuinely
valuable but not load-bearing; Phase 8's import/export can follow later without any refactoring,
because nothing else depends on it.

---

## Phase 0 — Foundation

**Goal:** an empty app that builds, deploys, and can talk to Supabase.

### Build
1. `npm create vite@latest job-application-tracker -- --template react-ts`
2. Install:
   ```
   @supabase/supabase-js @tanstack/react-query react-router-dom
   @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
   zod react-hook-form @hookform/resolvers
   tailwindcss postcss autoprefixer clsx tailwind-merge
   ```
   - `@dnd-kit/sortable` is needed for `sortableKeyboardCoordinates` (keyboard drag between
     columns), not for within-column sorting — see [07](./07-component-specifications.md).
   - `@dnd-kit/utilities` provides `CSS.Transform.toString()` for the drag transform.
   - `clsx` + `tailwind-merge` back `lib/cn.ts`.
3. Configure Tailwind; add the Inter font link; set the base neutral tokens from
   [04](./04-design-system.md).
4. Create the Supabase project. Copy the URL and anon key into `.env`; commit `.env.example`;
   add `.env` to `.gitignore` **in the first commit**.
5. `src/services/supabaseClient.ts` exactly as specified in [02](./02-backend-architecture.md),
   including the throw-on-missing-env guard.
6. Set up the folder skeleton from [03](./03-frontend-architecture.md) — empty files are fine;
   the structure being in place stops ad-hoc placement later.
7. Wire providers in `main.tsx`: `QueryClientProvider` → `AuthProvider` → `BrowserRouter`.
8. Set up Vitest + React Testing Library; one trivial passing test to prove the harness runs.
9. Deploy the empty shell to Vercel. Confirm the env vars are set in the hosting dashboard too —
   not just locally.

### Done when
The deployed URL loads a blank shell with no console errors, and `supabase.auth.getSession()`
returns `null` without throwing.

### Traps
- **Deploying before setting env vars in the host** produces the throw from `supabaseClient.ts` at
  runtime, which looks like a broken build. Set them first.
- Vite only exposes variables prefixed `VITE_`. A variable named `SUPABASE_URL` will be silently
  `undefined` in the browser.

---

## Phase 1 — Database and auth

**Goal:** real users can sign in, and the database is correct and locked down before a single row
of real data exists.

### Build
1. Initialize the Supabase CLI (`supabase init`, `supabase link`).
2. Write the migrations from [01](./01-database-schema.md). **Each table's migration is
   self-contained** — table + indexes + triggers + `enable row level security` + policies in the
   same file. Never a separate "add RLS later" migration.
   1. `create_enums`
   2. `create_applications` (incl. `user_id default auth.uid()`, `set_updated_at` trigger, RLS)
   3. `create_status_history` (incl. `record_status_change` trigger, select-only RLS)
   4. `enable_realtime` (publication + `replica identity full`)
3. Apply migrations; generate types:
   `supabase gen types typescript --project-id <id> > src/types/database.types.ts`. Commit it.
4. **Configure Auth URLs in the dashboard** — Site URL and Redirect URLs for *both* localhost and
   the deployed origin ([02](./02-backend-architecture.md) § Supabase dashboard configuration).
   Skipping this is the most common Supabase launch failure and it does not surface until a real
   confirmation email is sent from production.
5. `authService.ts` (incl. `emailRedirectTo`), `errors.ts` with `toAuthError`, `AuthContext`,
   `useAuth`, `ProtectedRoute`.
6. `LoginPage` with sign-in/sign-up toggle and the validation rules from
   [05](./05-features-and-workflows.md).
7. `constants/routes.ts` and the route table from [07](./07-component-specifications.md);
   `AppShell` with header, `ViewToggle` slot, Add button slot, and the account menu whose sign-out
   calls `signOut()` **then** `queryClient.clear()`.

### Done when
- Two separate accounts can sign up, confirm, sign in, and sign out.
- **The isolation check passes:** insert a row as user A via the SQL editor, sign in as user B,
  query `applications` from the browser console, and get `[]` — not an error, not A's row.
- Refreshing the page while signed in does **not** bounce to `/login` (the `isLoading` guard in
  `ProtectedRoute` is working).

### Traps
- **This is the phase where RLS mistakes are cheap to fix and later they are not.** Run the full
  security checklist at the end of [02](./02-backend-architecture.md) before moving on. In
  particular verify the `update` policy has both `using` and `with check`.
- Email confirmation is on by default in Supabase. Either confirm via the emailed link or disable
  confirmation for local development — but re-enable it before production.

---

## Phase 2 — Core data layer and Table view

**Goal:** a working tracker. Not pretty yet, but genuinely usable.

Table view comes before Kanban deliberately: it's the simpler surface, and building it first
proves the entire data path (service → hook → cache → UI) without drag-and-drop complexity
layered on top. If something is wrong in the service layer, you want to find it here.

### Build
1. `applicationsService.ts` — all five functions, `errors.ts` normalization.
2. `useApplications`, `useApplicationMutations` (including the optimistic `changeStatus`), and
   `queryKeys`.
3. `constants/status.ts` and `constants/platforms.ts`.
4. `ToastContext` + `useToast` + `ToastViewport` ([07](./07-component-specifications.md)) — build
   this **before** the first mutation call site, so success/error feedback is wired from the start
   rather than retrofitted into every mutation later.
5. `ApplicationFormModal` (create + edit modes), `lib/validation.ts` zod schemas, wired with
   `react-hook-form`. Include the `''`-handling and protocol refinement from
   [05](./05-features-and-workflows.md) — without them, saving without a job link fails.
6. `ApplicationsTable`, `TableRow`, basic `TableToolbar`.
7. `ui/` primitives per the APIs in [07](./07-component-specifications.md): `Button`, `Input`,
   `Select`, `Textarea`, `Modal`, `ConfirmDialog`, `EmptyState`, `Skeleton`.
8. Delete flow with confirmation.

### Done when
A user can add, view in a table, edit, and delete applications, and everything survives a refresh.
Status changes via the table's inline select work and write history rows (verify in the SQL
editor).

### Traps
- Send only changed fields on update. Sending the whole object, including `id` and `created_at`,
  works but makes future `updated_at` debugging confusing.
- Do not let the modal close on a failed save — [05](./05-features-and-workflows.md), F2 step 5.

---

## Phase 3 — Kanban board and drag-and-drop

**Goal:** the flagship view.

### Build
1. `KanbanBoard`, `KanbanColumn`, `ApplicationCard`.
2. `@dnd-kit` `DndContext` with `PointerSensor` (`activationConstraint: { distance: 8 }`) and
   `KeyboardSensor`.
3. Drop handler → `changeStatus.mutate`, with the optimistic path already built in Phase 2.
4. `ViewToggle` and the `?view=` URL parameter.
5. Drag visuals per [04](./04-design-system.md): dragged card shadow/rotation, dashed origin
   placeholder, column drag-over tint.

### Done when
- Dragging a card between columns updates it, persists across refresh, and writes a history row.
- **The rollback test passes:** force the mutation to reject (temporarily throw in the service)
  and confirm the card animates back to its original column with an error toast.
- Keyboard drag works: tab to a card, `Space`, arrows, `Space`.
- Switching Board ⇄ Table **with the table at its default sort** triggers no refetch (Network tab).
  With a non-default table sort, a refetch is expected and correct — see the sorting section in
  [03](./03-frontend-architecture.md).

### Traps
- **Without the 8px activation constraint, clicks never register** — every click is interpreted as
  a drag. This is the single most common `@dnd-kit` integration bug. (The drawer arrives in Phase 4;
  until then, verify with the `⋮` menu opening on click.)
- **A bare `KeyboardSensor` will not move between columns.** It translates the overlay 25px per
  arrow press. Pass `coordinateGetter: sortableKeyboardCoordinates` — see
  [07](./07-component-specifications.md).
- **`Space` cannot both open a card and lift it.** Card is a `div` with `role="button"` handling
  `Enter` only; `Space` belongs to the drag sensor. Full rationale in
  [07](./07-component-specifications.md).
- The dragged card must have no CSS transition, or it visibly lags behind the pointer.
- Optimistic updates must target `queryKeys.applications.lists`, **not** `.all` — `.all` prefix-
  matches the detail entry and `old.map` throws inside `onMutate` ([03](./03-frontend-architecture.md)).

---

## Phase 4 — Detail Drawer, filters, and search

**Goal:** the app becomes navigable at real data volumes.

### Build
1. `statusHistoryService.ts` + `ApplicationDetailDrawer` + `StatusTimeline`.
2. `Drawer` primitive (right slide on desktop, bottom sheet on mobile) with focus trap, `Esc`,
   backdrop click, and focus restore.
3. `useApplicationFilters` with URL sync; `FilterBar`, `StatusFilter`, `PlatformFilter`.
4. Debounced search (300ms) wired into the service query.
5. Sorting in the table (database-side `.order()`, status sorted by pipeline order).
6. Bulk selection and bulk actions.
7. Empty states for all four cases in [04](./04-design-system.md).

### Done when
Filters survive a page refresh via the URL, search returns correct results, the drawer shows a
complete timeline, and filtering in Kanban view hides non-matching columns entirely.

### Traps
- Debounce the *query*, not the input value — a debounced input feels laggy to type in.
- Kanban + status filter: hide the filtered-out columns rather than rendering them empty, or the
  board looks broken.

---

## Phase 5 — Responsive, accessibility, and realtime

**Goal:** genuinely usable on a phone, operable without a mouse, and consistent across devices.

### Build
1. `useMediaQuery` / `useIsMobile`.
2. `MobileStatusTabs` — tab bar, swipe between statuses, `⋮ → Move to…` for status changes.
3. Table → stacked card list below `768px`; filters into a bottom sheet.
4. Modal and drawer → bottom sheets on mobile.
5. Audit touch targets to 44×44px minimum.
6. `realtimeService.ts` + `useRealtimeApplications`, mounted once in `ApplicationsPage`.
7. Enable the table in the `supabase_realtime` publication.
8. Accessibility pass: focus rings everywhere, `aria-label` on icon-only buttons, drawer/modal
   focus traps verified, `prefers-reduced-motion` honored, status never conveyed by color alone.

### Done when
- The full flow works on a real phone (not just a narrow desktop window) — add, view, change
  status, read detail.
- Two browsers signed in as the same user stay in sync within a second or two.
- The whole app is operable start to finish with only a keyboard.

### Traps
- **Realtime must invalidate, never hand-patch the cache.** A realtime event racing an optimistic
  update produces duplicated or ghost cards — see [03](./03-frontend-architecture.md).
- Test on a real device. Chrome's device emulation does not reproduce touch-drag behavior
  faithfully.

---

## Phase 6 — Hardening and production

**Goal:** ready for daily reliance.

> **Testing is not actually deferred to this phase.** Each of Phases 1–5 writes tests for what it
> builds, alongside it — that is what the colocated-test convention in
> [03](./03-frontend-architecture.md) means in practice. This phase is where coverage is *audited*
> and the gaps are filled, not where testing begins. Building 25 components and then retrofitting
> tests produces tests shaped around the implementation instead of the behavior.

### Build
1. **Audit test coverage** and fill gaps:
   - Services: query shape + error normalization (mocked client).
   - Hooks: optimistic apply **and rollback** for `changeStatus`; filter state round-trips.
   - Components: form validation surfaces errors and blocks submit; card renders and fires
     callbacks; table sorts.
   - One end-to-end-ish integration test: add → appears in column → drag → persists.
2. Error boundary around the app shell with a recoverable fallback.
3. Offline banner via `navigator.onLine` + `online`/`offline` events.
4. Session-expiry handling: redirect to `/login` with the notice from
   [05](./05-features-and-workflows.md).
5. **`queryClient.clear()` on sign-out** — the cross-user cache leak noted in F1.
6. Loading skeletons (static, no shimmer) and the refetch-without-spinner behavior.
7. Run the full security checklist from [02](./02-backend-architecture.md) again against
   production.
8. Lighthouse pass; fix anything below 90 on Accessibility or Best Practices.
9. Production deploy: env vars set, Supabase email confirmation re-enabled, custom domain if
   wanted.

### Done when
Every checklist item in [02](./02-backend-architecture.md) passes against the production project,
tests pass in CI, and the app has been used for a real week of applications without a data issue.

---

## Phase 7 — Lifecycle: archive and stale detection

**Goal:** the app stays usable at month three, when the board has forty finished applications on it.

### Build
1. Migration: `is_archived` and `status_changed_at` columns, the partial indexes, the company/title
   index, and the extended `set_updated_at` trigger ([01](./01-database-schema.md)).
   Regenerate types.
2. `setArchived` + `findPotentialDuplicates` in the service layer; `archived` in `ApplicationFilters`.
3. `setArchived` mutation (optimistic) in `useApplicationMutations`.
4. `constants/staleness.ts`, `useStaleThreshold`, `StaleIndicator`.
5. Shared `ApplicationActions` menu ([07](./07-component-specifications.md)) replacing whatever
   ad-hoc menus Phases 2–3 produced; wire Archive/Restore into card, row, drawer, and bulk bar.
6. Archive scope in the filter overflow; the archive view (table-only, view toggle hidden).
7. "Needs follow-up" filter chip with count; threshold control (7/14/30/Off).
8. Duplicate-detection notice in the form, on job-title blur.
9. Toast Undo action support.

### Done when
- Archiving removes a row from the board immediately, Undo restores it, and it is still present in
  the archive view after a refresh.
- A Rejected application untouched for a month shows **no** stale marker; a Pending one does.
- Editing an application's notes does **not** clear its stale marker; changing its status does.
- Adding a duplicate shows the warning and still lets you save.

### Traps
- **`set_updated_at` must stay a `before` trigger** — an `after` trigger cannot assign `new`.
- The archive filter belongs in the **service layer**, not in components. Filtering archived rows out
  in the UI means every count, every view, and every future surface has to remember to do it.
- Do not make `is_archived` a status value. [01](./01-database-schema.md) explains why.

---

## Phase 8 — Import and export

**Goal:** people can get their existing applications in, and their data back out.

### Build
1. `npm i papaparse @types/papaparse`.
2. `lib/csv.ts`: `applicationsToCsvRows`, `downloadCsv` (with the UTF-8 BOM), header alias map, and
   the value coercion rules from [10](./10-data-import-export.md).
3. Export items in the filter overflow — current view, and all.
4. `bulkCreate` + `PartialImportError` in the service layer; `importMany` mutation.
5. `ImportModal` — the four-step machine, with Papaparse dynamically imported on open.
6. Duplicate checking across both existing rows and within the file itself.
7. The round-trip test ([08](./08-testing-and-ci.md)).

### Done when
- A CSV exported from the app re-imports cleanly, with every status and platform preserved.
- A file exported from Excel (BOM, `MM/DD/YYYY` dates, quoted commas) imports correctly.
- A row missing a company errors without blocking the other rows.
- Forcing a failure mid-import reports an honest "imported N of M" and offers a retry.

### Traps
- **Strip the BOM before matching headers**, or `Company` never maps and it looks like the alias
  table is broken.
- **Chunks must be sequential.** Parallel chunks make "the first 100 committed" an unprovable claim,
  which is exactly what the partial-failure message needs to state truthfully.
- Do not reconstruct `status_history` from imported data. Fabricated audit entries are worse than
  absent ones.

---

## Suggested order of first commits

For anyone starting from an empty repo, roughly this sequence keeps every commit shippable:

```
chore: scaffold vite + react-ts + tailwind
chore: add supabase client and env guard
feat: add database migrations for enums, applications, rls
feat: add auth context, login page, protected route
feat: add applications service and error normalization
feat: add useApplications and mutation hooks
feat: add application form modal with validation
feat: add table view with row actions
feat: add kanban board with drag-and-drop status changes
feat: add detail drawer with status timeline
feat: add filters, search, and url state sync
feat: add mobile layouts for board and table
feat: add realtime sync across sessions
ci: add lint, typecheck, test workflow
test: add playwright e2e for the drag-and-drop path
chore: add error tracking and security headers
feat: add archive and restore
feat: add stale application detection
feat: add duplicate detection on add
feat: add csv export
feat: add csv import with column mapping and review
chore: production hardening and deploy
```

---

## Definition of done, whole project

- [ ] Two users' data provably isolated (manual two-account test + RLS checklist).
- [ ] Add an application in under 15 seconds, minimum fields only.
- [ ] Kanban and Table always show the same data; toggling refetches nothing.
- [ ] A failed status change visibly rolls back and tells the user.
- [ ] Full flow works on a phone and works with keyboard only.
- [ ] Status history is complete and accurate for every application, regardless of which UI
      changed the status.
- [ ] No `service_role` key anywhere in the frontend or git history.
- [ ] Signing out leaves no previous user's data in the cache.
- [ ] CI blocks a PR that fails lint, typecheck, tests, or E2E.
- [ ] Archived applications are invisible everywhere except the archive view, and are excluded at
      the service layer rather than in components.
- [ ] Stale markers appear on non-terminal applications past the threshold, and editing a note does
      not reset the clock.
- [ ] A CSV exported from the app re-imports with no data loss.
- [ ] Sentry receives errors from production and contains no company names, salary figures, notes,
      or query strings.
- [ ] Security headers verified post-deploy, with realtime sync and font loading still working.

---

## Where to look when something breaks

| Symptom | Most likely cause | Doc |
|---|---|---|
| Empty list despite rows existing in the table editor | RLS policy missing or `user_id` not set on insert | [01](./01-database-schema.md), [02](./02-backend-architecture.md) |
| Signed-in user bounced to `/login` on refresh | `ProtectedRoute` not handling `isLoading` | [03](./03-frontend-architecture.md) |
| Card clicks never open the drawer | Missing `activationConstraint` on the pointer sensor | Phase 3 traps |
| Duplicated or ghost cards | Realtime hand-patching the cache instead of invalidating | [03](./03-frontend-architecture.md) |
| Card stays in the new column after a failed save | `onError` rollback not restoring the snapshot | [03](./03-frontend-architecture.md) |
| Previous user's applications flash after switching accounts | `queryClient.clear()` missing on sign-out | [05](./05-features-and-workflows.md) F1 |
| `42501` errors in logs | RLS denial — policy wrong or session expired mid-request | [02](./02-backend-architecture.md) |
| Every save without a job link fails with `23514` | `''` not normalized to `null` before insert | [01](./01-database-schema.md), [02](./02-backend-architecture.md) |
| Realtime syncs adds and edits but not deletes | `replica identity full` not set on the table | [02](./02-backend-architecture.md) |
| Confirmation emails from production link to `localhost` | Site URL / Redirect URLs not configured in the dashboard | [02](./02-backend-architecture.md) |
| Realtime silently stops working after adding a CSP | `wss://*.supabase.co` missing from `connect-src` | [09](./09-operations.md) |
| Stale markers clear when a note is edited | Staleness reading `updated_at` instead of `status_changed_at` | [01](./01-database-schema.md), [05](./05-features-and-workflows.md) F10 |
| CSV import maps every column except Company | UTF-8 BOM not stripped before header matching | [10](./10-data-import-export.md) |
| Archived rows appear in a count or a new view | Archive filtered in a component instead of the service layer | [02](./02-backend-architecture.md) |
| App returns connection errors after a quiet week | Free-tier project paused after 7 days of inactivity | [09](./09-operations.md) |
