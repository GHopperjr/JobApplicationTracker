# 05 — Features & Workflows

This document specifies each feature end to end — what the user does, what the UI does, what the
service layer calls, and what the database receives. Where a decision was made, the reasoning is
stated so it isn't relitigated during implementation.

---

## F1 — Authentication

### Sign up
1. User enters email + password on `/login` (toggle to sign-up mode).
2. `authService.signUp(email, password)` → `supabase.auth.signUp(...)`.
3. Supabase sends a confirmation email; UI shows "Check your email to confirm your account."
4. On confirmation, the link returns to the app; `detectSessionInUrl` completes the session.

### Sign in
1. `authService.signIn(email, password)`.
2. On success, `AuthContext` receives the session via `onAuthStateChange` and
   `ProtectedRoute` allows `/applications` to render.
3. On failure, one inline message: "Email or password is incorrect." **Never** distinguish between
   "no such account" and "wrong password" — that difference lets someone enumerate registered
   emails.

### Sign out
`supabase.auth.signOut()`, then clear the TanStack Query cache
(`queryClient.clear()`) — otherwise the next user to sign in on the same device briefly sees the
previous user's cached applications before the refetch lands. This is a real leak of one user's
data to another, and it is entirely a client-side cache issue that RLS cannot protect against.

### Validation
| Field | Rule |
|---|---|
| Email | Valid format; required |
| Password | Minimum 8 characters; required. No composition rules (forced symbols/numbers measurably push users toward weaker, more predictable passwords) |

---

## F2 — Add an application

**Goal: under 15 seconds for the minimum case.** This is the most frequently repeated action in
the app and its friction determines whether the tool gets used at all.

### Entry points
- Primary "Add Application" button in the header (always visible, both views).
- Empty-state button on first run.
- Keyboard shortcut `N` when no input is focused.

### The form (`ApplicationFormModal`, create mode)

| Field | Control | Required | Default |
|---|---|---|---|
| Company name | Text input | ✱ | empty, autofocused |
| Job title | Text input | ✱ | empty |
| Platform | Select | ✱ | `jobstreet` |
| Status | Select | ✱ | `pending_application` |
| Job link | URL input | — | empty |
| Location | Text input | — | empty |
| Salary range | Text input | — | empty |
| Applied date | Date input | — | today |
| Notes | Textarea (3 rows) | — | empty |

**Layout:** the four required fields sit at the top in a single visual group; optional fields
follow below a hairline divider. The user can tab through four fields and hit Save.

**Applied date defaults to today** because the overwhelmingly common case is adding an application
right after submitting it. It remains editable for backfilling.

### Validation (`lib/validation.ts`, zod)

```ts
import { STATUS_VALUES } from '../constants/status';
import { PLATFORM_VALUES } from '../constants/platforms';

// Both constants are declared `as const` (readonly tuples) — z.enum() will not
// accept a mutable string[]. See 03 § Constants.

const httpUrl = z
  .string()
  .trim()
  .url('Enter a valid URL starting with http:// or https://')
  // z.url() alone accepts ftp:// and mailto:, which the database check constraint
  // then rejects with an opaque 23514. Enforce the protocol here so the user gets
  // the real message.
  .refine((v) => /^https?:\/\//i.test(v), {
    message: 'Enter a valid URL starting with http:// or https://',
  });

export const applicationSchema = z.object({
  company_name: z.string().trim().min(1, 'Company name is required'),
  job_title: z.string().trim().min(1, 'Job title is required'),
  platform_source: z.enum(PLATFORM_VALUES),
  status: z.enum(STATUS_VALUES),

  // Optional fields accept '' from a cleared input and are coerced to null before
  // they reach Postgres (see 01 § The empty-string rule). Without the ''-handling
  // below, EVERY application saved without a job link fails the check constraint.
  job_link: z.union([z.literal(''), httpUrl]).optional(),
  salary_range: z.string().trim().max(100).optional(),
  location: z.string().trim().max(200).optional(),
  applied_date: z.union([z.literal(''), z.string().date()]).optional(),
  notes: z.string().max(5000).optional(),
});

export type ApplicationFormValues = z.infer<typeof applicationSchema>;
```

**Where `''` → `null` happens:** in the service layer's `normalizeOptionalFields`
([02](./02-backend-architecture.md)), not here. The schema's job is to tell the user what is wrong;
the service's job is to send Postgres something it can store. Doing the coercion in the form would
mean every future write path has to remember it.

**URL validation specifics** (the requirement calls this out explicitly):
- Empty is valid — the link is optional.
- Must parse as a URL and use `http`/`https`. A pasted job ID or bare `www.jobstreet.com.ph`
  fails with a message that says exactly what to fix.
- **Auto-prefix convenience:** if the value has no scheme but otherwise looks like a domain, the
  form silently prepends `https://` on blur rather than erroring. Pasting `www.linkedin.com/jobs/…`
  is common enough that correcting it for the user is better than scolding them.
- The database enforces the same rule as a `check` constraint ([01](./01-database-schema.md)) —
  client validation is for the user's benefit, the constraint is for correctness.

### Duplicate detection

Applying to the same role twice — once through JobStreet, once through the company site — happens
often enough to be worth catching, and often enough to be *legitimate*, so this warns and never
blocks.

1. On blur of the **Job title** field (both company and title now filled), call
   `findPotentialDuplicates(company, title)` ([02](./02-backend-architecture.md)).
2. If any match, show an inline notice above the form actions — not a modal, not a blocking error:

   > **You already have an application for this role.**
   > Acme Corporation · Junior Backend Developer — added Sep 1 via JobStreet, currently *Interviewed*
   > [View it] · [Add anyway]

3. Submit stays fully enabled throughout. "Add anyway" merely dismisses the notice.
4. The lookup is case-insensitive on both fields and **includes archived rows** — "you already
   applied and archived it" is precisely the case worth knowing.
5. In edit mode, the record being edited is excluded via `excludeId`, or every save would flag
   itself.

**Failure is silent.** If the duplicate lookup errors, the notice simply does not appear — a
convenience check must never prevent someone from adding an application.

### Submit flow
1. Client-side validation runs; first invalid field receives focus.
2. `create.mutate(values)` → `applicationsService.createApplication`.
3. `user_id` is **not** sent — the column default `auth.uid()` supplies it.
4. On success: modal closes, toast "Application added.", query cache invalidated, new card
   appears in its status column.
5. On failure: modal **stays open** with the user's input intact and an inline error above the
   actions. Never discard typed input on a failed save.
6. Database trigger writes the initial `status_history` row automatically.

---

## F3 — Edit an application

Same component as F2 in edit mode — one form, two modes, so the two can never drift apart in
validation or field set.

- Opened from a card's `⋮` → Edit, a table row's `⋮` → Edit, or the Detail Drawer's Edit button.
- Form is pre-filled from the existing record; the modal title changes to "Edit Application" and
  the submit button to "Save changes".
- Only changed fields are sent as the patch — `updateApplication(id, patch)`.
- If the status field is changed here, the database trigger records it in the timeline exactly as
  a drag would. Status changes are equivalent regardless of which UI produced them.
- Closing with unsaved changes prompts a confirmation ("Discard changes?"), because a
  half-written note is genuinely annoying to lose.

---

## F4 — Kanban board

### Structure
Five columns in `STATUS_ORDER`, each rendering the cards from `useApplications().byStatus`.

### Drag-and-drop (`@dnd-kit`)

**Interaction contract:**
- Drag activates after 8px of movement (`activationConstraint: { distance: 8 }`) — without this,
  every click registers as a micro-drag and card clicks never open the drawer.
- While dragging: the card follows the pointer with `shadow-lg` and slight rotation; its origin
  shows a dashed placeholder; the hovered column body takes `bg-slate-100`.
- Drop on a different column → status change. Drop on the same column → no-op (no reordering
  within a column; see below).
- Keyboard: `Space` to lift, arrow keys to move between columns, `Space` to drop, `Esc` to cancel.
  `@dnd-kit` provides this and it must not be disabled — it is the only way the board is operable
  without a pointer.

**Why there is no manual card ordering within a column:** cards are ordered by `created_at desc`,
period. Supporting drag-to-reorder would require a `position` column, a reindexing strategy, and
conflict handling across devices — real complexity in exchange for an ordering preference that
this app has no evidence users want. If it's ever needed, it's an additive migration.

### Status change flow (the hot path)
1. Drop event fires with `applicationId` and target `status`.
2. `changeStatus.mutate({ id, status })`.
3. `onMutate` optimistically moves the card — **the card appears in the new column instantly**,
   before any network call completes.
4. Request goes to Supabase; the `record_status_change` trigger writes a history row.
5. On success, `onSettled` refetches and reconciles (picking up `updated_at`).
6. On failure, `onError` restores the snapshot — **the card visibly animates back to its original
   column** — and a toast reads "Couldn't update status. Please try again."

The failure path is explicitly part of the spec: a card that silently stays in the wrong column
after a failed save is worse than no optimistic update at all, because the user believes a change
was recorded that wasn't.

### Column headers
`{Status label} · {count}`. The count comes from the grouped data, not a separate query.

---

## F5 — Table view

### Columns and behavior

| Column | Sortable | Notes |
|---|---|---|
| Company | ✓ | Primary identifier, always first |
| Job Title | ✓ | |
| Status | ✓ | Renders `StatusBadge`; sorts by pipeline order (see below) |
| Platform | ✓ | |
| Location | — | Free text, sorting it is not meaningful |
| Applied | ✓ | Nullable; undated rows sort last in both directions |
| Salary | — | Free text ("Competitive"), so sorting would be misleading |
| `⋮` | — | Row actions |

**Sorting happens in the database** via the service layer's `.order()`, not client-side — see
[03](./03-frontend-architecture.md) for why.

**Status sorts by pipeline order, not alphabetically.** An alphabetical status sort
(Accepted, Interviewed, Pending, Rejected, Scheduled) is meaningless to a user thinking in stages.

**This needs no special implementation.** Postgres enums sort by *declaration* order, and
`application_status` is declared in pipeline order in [01](./01-database-schema.md) — so a plain
`.order('status')` already yields Pending → Scheduled → Interviewed → Rejected → Accepted. Do not
reach for a `CASE` expression or an RPC: PostgREST's `order` parameter accepts column names with
`asc`/`desc`/`nullsfirst`/`nullslast` only, and cannot express one anyway.

**Default sort is `created_at desc`** (matching `DEFAULT_SORT` in
[02](./02-backend-architecture.md)), not `applied_date` — `applied_date` is nullable, so undated
rows would need a null-ordering rule, and the date an application was *added* is the more reliable
recency signal.

### Inline status change
The status cell is a `Select`, not static text — changing it calls the same
`changeStatus` mutation the Kanban drag uses. Same code path, same optimistic behavior, same
history record.

### Bulk actions
- Checkbox column appears on hover of the header, plus a persistent "select all" once any row is
  selected.
- With ≥1 row selected, the toolbar swaps to a selection bar: "{n} selected" + `Change status ▾` +
  `Archive` + `Delete`. (`Archive` reads `Restore` while the archive view is active.)
- **Bulk status change is one request**, via `bulkUpdateStatus(ids, status)` →
  `.update({ status }).in('id', ids)` ([02](./02-backend-architecture.md)).

  **It must not be implemented as N concurrent single-row `changeStatus` mutations.** Each
  mutation's `onMutate` snapshots the cache — and mutation #2 snapshots a cache that already
  contains mutation #1's optimistic write. If #1 then fails, its `onError` restores a snapshot
  taken *before* #2's change, silently reverting a row the user successfully updated. Concurrent
  optimistic mutations over shared cache entries corrupt each other's rollback; a single request
  has a single rollback.

  The bulk mutation's optimistic update patches all selected ids in one `setQueriesData` pass and
  rolls back as one unit.
- Bulk delete always confirms, naming the count: "Delete 7 applications? This cannot be undone."

---

## F6 — Detail Drawer

Opened by clicking a card (Kanban) or a row (Table). Slides in from the right on desktop; bottom
sheet on mobile.

### Contents, in order

```
┌───────────────────────────────────────┐
│ Acme Corporation                  ✕   │  company (20/600)
│ Junior Backend Developer              │  title (14/400 slate-600)
│ [Pending Application]                 │  StatusBadge
├───────────────────────────────────────┤
│ Platform      JobStreet               │
│ Location      Makati City             │
│ Salary        ₱25,000 – ₱32,000/month │  definition list:
│ Applied       Sep 1, 2026             │  label 12/500 slate-600
│ Job link      jobstreet.com/job/… ↗   │  value 14/400 slate-900
├───────────────────────────────────────┤
│ NOTES                                 │
│ Applied through JobStreet quick       │
│ apply. Recruiter mentioned…           │
├───────────────────────────────────────┤
│ TIMELINE                              │
│ ● Interviewed        Sep 3, 2:15 PM   │
│ ● Scheduled          Sep 2, 9:40 AM   │
│ ● Pending            Sep 1, 8:12 AM   │
├───────────────────────────────────────┤
│              [Edit]  [Delete]         │
└───────────────────────────────────────┘
```

- **Empty optional fields are omitted entirely**, not shown as "—". A drawer listing six empty
  labels tells the user nothing and buries the fields that do have values.
- **Job link** renders as a shortened, clickable link opening in a new tab with
  `rel="noopener noreferrer"` — required, since the destination is an arbitrary third-party URL.
- **Notes** preserve line breaks (`whitespace-pre-wrap`). Plain text only in v1 — no markdown
  rendering, which would create an escaping/XSS surface for a feature nobody asked for.
- **Timeline** comes from `statusHistoryService.listForApplication(id)`, newest first, each entry
  showing the status moved *to* and when. It is read-only, matching the append-only,
  trigger-written table design in [01](./01-database-schema.md).

### Delete
Always confirms via `ConfirmDialog`, naming the application: "Delete the application for Junior
Backend Developer at Acme Corporation? This cannot be undone." Deleting cascades to
`status_history` via the foreign key.

---

## F7 — Filtering, search, and the view toggle

### Filters (both views)
- **Status** — multi-select chips. In Kanban view, filtering to a subset of statuses hides the
  non-matching columns entirely rather than showing empty ones.

  **Edge case, specified so it isn't invented:** a card dragged to a status that is filtered out
  cannot happen — that column isn't rendered, so there is no drop target for it. But a card whose
  status is changed via its `⋮` menu to a filtered-out status *does* leave the current filter. In
  that case the optimistic update removes it from the visible board immediately (it no longer
  matches the filter), and a toast confirms: "Moved to Rejected — hidden by your current filter."
  Silently vanishing cards are alarming; a card that vanishes with an explanation is not.
- **Platform** — multi-select.
- **Search** — one input matching `company_name` OR `job_title`, case-insensitive, debounced
  300ms before firing the query.
- **Needs follow-up** — a single toggle chip showing the current stale count (`Needs follow-up · 3`).
  Filters to stale applications only (F10). Hidden entirely when the stale threshold is set to Off.
- **Archived scope** — in the filter bar's overflow menu, not a chip: *Active* (default) /
  *Archived* / *All*. It is a mode rather than a filter, and giving it chip-level prominence would
  imply archived rows are one filter click away from the normal view, which is the opposite of the
  intent.

All of these live in the URL (`?status=…&platform=…&q=…&stale=1&archived=archived`), so a filtered
view is shareable and survives refresh — see [03](./03-frontend-architecture.md).

**Stale filtering is client-side**, unlike every other filter. Staleness is a computed property of
`status_changed_at` relative to *now* and a user-local threshold, so it has no server-side
predicate to push down. It filters the already-fetched result set — which is correct here precisely
because the set is capped at 500 rows.

### Clearing
A single "Clear all" ghost button appears only when at least one filter is active. Individual
chips are also removable.

### View toggle
Two-segment control (Board | Table) in the header, persisted to `?view=`. Both views read the same
cached query, so switching is instant and triggers no refetch.

---

## F8 — Feedback and error handling

| Event | Feedback |
|---|---|
| Application created | Toast: "Application added." |
| Application updated | Toast: "Changes saved." |
| Status changed (drag) | No toast on success — the card visibly moved, which is the feedback. A toast for every drag would be noise. |
| Status change failed | Toast (error): "Couldn't update status. Please try again." + card animates back |
| Application deleted | Toast: "Application deleted." |
| Network offline | Persistent banner: "You're offline. Changes will be saved when you reconnect." |
| Session expired | Redirect to `/login` with a one-line notice: "Your session expired. Please sign in again." |

**Toast rules:** bottom-right on desktop, bottom-center on mobile, 4s auto-dismiss, max 3 stacked,
never blocking. Success toasts are only for actions whose result isn't already visible on screen —
which is why a successful drag has none. Implementation (`ToastContext` + `useToast`) is specified
in [07](./07-component-specifications.md).

### Offline behavior, precisely

The banner wording above is deliberate. TanStack Query v5's default `networkMode: 'online'` **pauses
mutations while offline and resumes them on reconnect** — it does not discard them. Telling the user
"changes will not be saved" would be false, and would push them to redo work that is already queued.

What this means for an optimistic status change made while offline: the card moves, the mutation
stays paused (neither settled nor rolled back), and the move commits when connectivity returns. The
card should render at 60% opacity while its mutation is paused so the state is visible rather than
silently pending.

---

---

## F9 — Archive and restore

Archiving hides an application from every default view without deleting it. It is orthogonal to
status ([01](./01-database-schema.md)) — an archived application keeps whatever status it had.

### Why this exists
Delete is currently the only way to clear a board of forty finished applications, and it destroys
the `status_history` timeline this schema went out of its way to make durable. Archive is the
non-destructive answer.

### Entry points
- Card `⋮` → **Archive**
- Table row `⋮` → **Archive**
- Detail Drawer → **Archive** (beside Edit/Delete)
- Table bulk selection → **Archive** (the common case: select every Rejected row, archive in one go)

### Behavior
1. `setArchived.mutate({ ids, isArchived: true })` — optimistic, so the row leaves the view at once.
2. Toast: "Archived." with an **Undo** action that calls the inverse mutation. Undo is available for
   the toast's 4-second lifetime; after that, restoring happens from the archive view.
3. Archived rows never appear in the board, the table, or any count — they are excluded at the
   service layer ([02](./02-backend-architecture.md)), not filtered in components.
4. **They are still searched and matched by duplicate detection**, which is deliberate.

### The archive view
- Reached from a "Show archived" item in the filter bar's overflow, which sets `?archived=archived`.
- Same table component, with the treatment in [04](./04-design-system.md) (60% opacity, muted
  company name, no drag).
- Row `⋮` → **Restore** returns it to the active view.
- The view is table-only. A Kanban board of archived applications is a pipeline of things that are
  not in the pipeline; the toggle is hidden while `archived=archived`.

### What archive does *not* do
- It does not change status, and it writes no `status_history` row.
- It does not cascade — archiving is per-application, with no notion of archiving a whole status.
- It is not a soft delete. Delete still exists, still cascades to history, and is still permanent.

---

## F10 — Stale application detection

**The single feature most aligned with why this app exists.** The failure mode a job tracker is
supposed to prevent is not "I forgot what I applied to" — it is "I never followed up on the one that
was going well."

### The rule
An application is stale when **all** of these hold:
- Its status is not terminal (`rejected` / `accepted` are never stale).
- It is not archived.
- `now() - status_changed_at` exceeds the threshold (default **14 days**).

Computed client-side by `isStale()` ([03](./03-frontend-architecture.md)) from the
`status_changed_at` column, so it costs no extra query and updates the moment a status changes.

### Surfacing
- Amber dot on the card and in the table row ([04](./04-design-system.md)), with a tooltip and
  accessible label reading "No change in 18 days."
- A **"Needs follow-up"** filter chip in the filter bar showing the current stale count, e.g.
  `Needs follow-up · 3`. Selecting it filters to stale applications only.
- **No notifications, no emails, no badge on the tab.** Those need the notification infrastructure
  explicitly deferred in [00](./00-overview.md), and a passive marker is enough for a tool the user
  opens several times a week anyway.

### Threshold setting
- Adjustable in a small "Follow-up reminder" control in the filter bar overflow: 7 / 14 / 30 days,
  or Off.
- Persisted to `localStorage` under `jat.staleThresholdDays` — the app's only preference, and not
  worth a database table plus RLS policies ([03](./03-frontend-architecture.md) explains the
  trade-off).
- "Off" hides every stale marker and the filter chip entirely.

### Why `status_changed_at` and not `updated_at`
Editing a note would reset an `updated_at`-based clock — so writing "recruiter said they'd follow up
next week" would mark the application as freshly-progressed when nothing progressed at all. That is
backwards for the exact case this feature exists to catch.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `N` | New application |
| `/` | Focus search |
| `Esc` | Close modal / drawer / cancel drag |
| `V` | Toggle Board ⇄ Table |
| `Space` / arrows | Lift, move, drop a focused card (via `@dnd-kit`) |

All shortcuts are suppressed while an input, textarea, or select has focus.

---

## Explicitly deferred

Recorded here so they are visibly *decisions*, not oversights:

- Reordering cards within a column (F4) — needs a `position` column and conflict handling.
- Rich text / markdown notes (F6) — escaping surface with no demonstrated need.
- Attachments (resume version used, screenshots of a posting) — needs Supabase Storage plus its
  own RLS policy set.
- Interview date as a first-class field with reminders — belongs with a notifications phase, not
  in a tracker's first release. F10's stale detection covers the underlying need (not losing track
  of a follow-up) without it.
- Analytics ("response rate by platform", "average days in stage") — the `status_history` and
  `status_changed_at` design makes this straightforward later; nothing here precludes it.
- CSV import in *update* mode (upsert against existing rows) — import creates only
  ([10](./10-data-import-export.md)). An import that silently overwrites edits made in the app is a
  data-loss bug wearing a feature's clothes.
- Cross-device sync of the stale threshold — it lives in `localStorage`, since one integer does not
  justify a `user_preferences` table plus its RLS policy set. The moment a second preference exists,
  that calculus changes.

---

Next: [06 — Implementation Roadmap](./06-implementation-roadmap.md).
