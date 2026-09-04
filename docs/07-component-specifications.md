# 07 — Component & Composition Specifications

The other documents specify layers, data, and visual treatment. This one specifies the pieces that
sit between them: **what routes exist, what the page actually composes, and the API of every shared
component** — the things a developer would otherwise have to invent, where inventing differently
from the rest of the docs means rework.

---

## Routing

```ts
// src/constants/routes.ts
export const ROUTES = {
  login: '/login',
  applications: '/applications',
  application: (id: string) => `/applications/${id}`,
} as const;
```

| Path | Component | Auth | Notes |
|---|---|---|---|
| `/` | — | — | `<Navigate to="/applications" replace />` |
| `/login` | `LoginPage` | public | Redirects to `/applications` if a session already exists |
| `/applications` | `ApplicationsPage` | protected | The main screen. View, filters, and sort live in the query string |
| `/applications/:id` | `ApplicationsPage` | protected | **Same page**, with the Detail Drawer open for `:id` |
| `*` | `NotFoundPage` | public | Message + link back to `/applications` |

### Why the drawer is a route, not local state

`/applications/:id` renders the identical page — the drawer is driven by the route param, not by a
`useState` in the page. This is the mechanism that makes browser Back close the drawer, which
[03](./03-frontend-architecture.md) promises when it justifies URL state. It also makes a specific
application linkable, which matters the moment a user wants to send themselves a link.

Filters and view survive drawer navigation because they live in the query string, which
`react-router` preserves across a path change when you construct the link with the current
`location.search`.

```tsx
// App.tsx
<Routes>
  <Route path="/" element={<Navigate to={ROUTES.applications} replace />} />
  <Route path={ROUTES.login} element={<LoginPage />} />
  <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
    <Route path={ROUTES.applications} element={<ApplicationsPage />} />
    <Route path="/applications/:id" element={<ApplicationsPage />} />
  </Route>
  <Route path="*" element={<NotFoundPage />} />
</Routes>
```

`AppShell` is a layout route rendering `<Outlet />`, so the header persists across both application
routes without remounting.

---

## `AppShell`

The only chrome in the app. Persistent across `/applications` and `/applications/:id`.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Applications          [ Board │ Table ]        [+ Add Application]  │  ← desktop
│                                                          paul@… ▾    │
└──────────────────────────────────────────────────────────────────────┘
```

| Element | Placement | Notes |
|---|---|---|
| Page title "Applications" | left | `text-xl font-semibold`. The app has one screen; no nav links exist |
| `ViewToggle` | center on desktop, below the title row on mobile | Two-segment Board/Table control |
| "Add Application" | right | Primary button. On mobile, collapses to a `+` icon button with `aria-label="Add application"` |
| Account menu | far right | The signed-in email, truncated, opening a menu with a single "Sign out" item |

- Height: 56px desktop, 52px mobile. `bg-white`, `border-b border-slate-200`, no shadow.
- Sticky (`sticky top-0 z-20`) so the toggle and Add button stay reachable while scrolling a long
  board.
- On mobile the header wraps to two rows: title + `+` on the first, `ViewToggle` full-width on the
  second.

**Sign out calls both** `authService.signOut()` **and** `queryClient.clear()`. The order matters —
clear the cache after the sign-out resolves, or an in-flight refetch can repopulate it. This is the
cross-user cache leak described in [05](./05-features-and-workflows.md) F1, and `AppShell`'s account
menu is the one place it is triggered.

---

## `ApplicationsPage` — composition contract

The single screen. This is where every hook is called and every prop originates; it is deliberately
the only component in the app that knows about both data and layout.

```tsx
export function ApplicationsPage() {
  const { id } = useParams();                       // drawer target, or undefined
  const navigate = useNavigate();
  const location = useLocation();
  const { filters, sort, view, setFilters, setSort, setView } = useApplicationFilters();
  const { applications, byStatus, isLoading, isError, error } = useApplications(filters, sort);
  const mutations = useApplicationMutations();
  const isMobile = useIsMobile();

  useRealtimeApplications();                        // mounted exactly once, here
  useKeyboardShortcuts({ onNew: openCreate, onToggleView: setView, onFocusSearch });

  const [formState, setFormState] = useState<
    { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; application: Application }
  >({ mode: 'closed' });

  const openDetail = (appId: string) =>
    navigate({ pathname: `/applications/${appId}`, search: location.search });
  const closeDetail = () =>
    navigate({ pathname: ROUTES.applications, search: location.search });
  // …
}
```

### What it owns

| Concern | Owner | Why |
|---|---|---|
| Data fetching | `ApplicationsPage` (via hooks) | One call site → one cache entry → the "toggle without refetch" guarantee |
| Drawer open/closed | the route (`:id`) | Back button closes it |
| Form modal open/closed + mode | `useState` in the page | Not URL state — a half-filled form isn't meaningfully linkable, and restoring one from a URL would be worse than not |
| Filters / sort / view | URL, via `useApplicationFilters` | Shareable, survives refresh |
| `DndContext` | `KanbanBoard`, not the page | Drag state is entirely internal to the board; the page only receives the resulting status change |

### What it passes down

```tsx
{view === 'kanban' ? (
  <KanbanBoard
    byStatus={byStatus}
    isLoading={isLoading}
    onCardClick={openDetail}
    onEdit={(app) => setFormState({ mode: 'edit', application: app })}
    onDelete={(app) => confirmDelete(app)}
    onStatusChange={(id, status) => mutations.changeStatus.mutate({ id, status })}
    isMobile={isMobile}
  />
) : (
  <ApplicationsTable
    applications={applications}
    sort={sort}
    onSortChange={setSort}
    isLoading={isLoading}
    onRowClick={openDetail}
    onEdit={…}
    onDelete={…}
    onStatusChange={…}
    onBulkStatusChange={(ids, status) => mutations.bulkStatus.mutate({ ids, status })}
    onBulkDelete={(ids) => confirmBulkDelete(ids)}
    isMobile={isMobile}
  />
)}

{id && <ApplicationDetailDrawer applicationId={id} onClose={closeDetail} onEdit={…} onDelete={…} />}
{formState.mode !== 'closed' && <ApplicationFormModal … />}
```

**Prop drilling depth is two levels at most** (page → board → column → card is three, but only
`onCardClick`/`onStatusChange` travel the full distance). If a third callback needs to reach the
card, that is the signal to introduce a small board-scoped context — not to let the card call a
hook.

---

## `MobileStatusTabs` vs `KanbanBoard`

`KanbanBoard` branches internally on `isMobile` rather than the page choosing between two
components. The board owns the concept of "columns by status" in both layouts, and splitting it
would duplicate the grouping and empty-state logic.

```tsx
function KanbanBoard({ byStatus, isMobile, ... }) {
  if (isMobile) return <MobileStatusTabs byStatus={byStatus} ... />;
  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {STATUS_ORDER.map((status) => <KanbanColumn key={status} ... />)}
      <DragOverlay>{activeCard && <ApplicationCard ... isDragging />}</DragOverlay>
    </DndContext>
  );
}
```

`DndContext` is not rendered at all on mobile — this is what makes "drag is disabled below 768px"
([04](./04-design-system.md)) literally true rather than a convention.

### Sensors (desktop only)

```ts
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
);
```

**`coordinateGetter` is required and is not the default.** A bare `KeyboardSensor` translates the
drag overlay by 25px per arrow keypress — it moves *pixels*, not *between droppables*, so the
"arrow keys move between columns" behavior promised in [05](./05-features-and-workflows.md) F4 will
simply not work without it. `sortableKeyboardCoordinates` comes from `@dnd-kit/sortable`, which is
why that package is installed despite the board having no within-column sorting.

### Card focus vs. card drag — the keyboard conflict

`ApplicationCard` cannot be a `<button>` whose whole surface is also the drag handle: `Space` would
both activate the button (open the drawer) and lift the drag. The resolution:

- The card is a `<div>` with `role="button"`, `tabIndex={0}`, and an `onKeyDown` handling **`Enter`
  only** → open drawer.
- `Space` is left to `@dnd-kit`'s `KeyboardSensor` → lift.
- A visible drag affordance (`⠿` handle, `aria-label="Reorder"`) appears on hover/focus at the
  card's left edge and carries the dnd listeners; pointer drag still works from anywhere on the
  card.

Result: keyboard users get `Enter` to open and `Space` to drag, and both are reachable — satisfying
the "operable start to finish with only a keyboard" gate in [06](./06-implementation-roadmap.md).

---

## Row and card action menus (`⋮`)

One menu component, used by both `ApplicationCard` and `TableRow`, so the two can never offer
different actions for the same record.

```ts
type ApplicationActionsProps = {
  application: Application;
  onView: () => void;
  onEdit: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
  onStatusChange: (status: ApplicationStatus) => void;
  showMoveTo: boolean;   // true on mobile — the only status-change path there (doc 04)
};
```

| Item | Shown when | Notes |
|---|---|---|
| View details | always | Same as clicking the card/row |
| Edit | always | Opens the form modal in edit mode |
| Move to ▸ | `showMoveTo` | Submenu of the four other statuses. The **only** way to change status on mobile, since drag is disabled below 768px |
| Archive | `!application.is_archived` | Optimistic; toast with Undo (F9) |
| Restore | `application.is_archived` | Same mutation, inverted |
| Delete | always | Opens `ConfirmDialog`; destructive styling |

Delete is separated from the rest by a divider, and is the only item using `text-rose-600`.

## `StaleIndicator`

```ts
type StaleIndicatorProps = { statusChangedAt: string; status: ApplicationStatus };
```

Renders nothing unless `isStale(...)` returns true against the current threshold
([03](./03-frontend-architecture.md)). When it does: a 6px `bg-amber-500` dot with
`title` and `aria-label` reading `No change in ${daysSinceStatusChange(...)} days`.

It reads the threshold from `localStorage` via `useStaleThreshold()` rather than taking it as a
prop — otherwise the value threads through the page → board → column → card, and every consumer has
to remember to pass it.

```ts
// src/hooks/useStaleThreshold.ts
export function useStaleThreshold(): {
  thresholdDays: number | null;      // null = the feature is switched off
  setThresholdDays: (days: number | null) => void;
};
```

Backed by `localStorage` with a `storage` event listener, so changing the threshold in one tab
updates the markers in another.

## `ImportModal`

The four-step flow from [10](./10-data-import-export.md). One component with an internal step
machine rather than four routed screens — the whole thing is transient and nothing about a
half-completed import is worth restoring from a URL.

```ts
type ImportStep =
  | { step: 'choose' }
  | { step: 'map'; rows: RawCsvRow[]; headers: string[] }
  | { step: 'review'; mapping: ColumnMapping; parsed: ParsedImportRow[] }
  | { step: 'importing'; toImport: ApplicationInsert[]; progress: number }
  | { step: 'result'; imported: number; failed: number; error?: PartialImportError };
```

- **Back is available at every step before `importing`**, and returning to `map` re-runs parsing
  rather than reusing stale results.
- **No step is skippable**, even when every column maps cleanly — the review step is the only place
  a user sees what is about to be written, and skipping it for "clean" files is how a bad
  auto-mapping ships thirty wrong rows.
- Papaparse is dynamically imported when the modal first opens, not at module load.

## Toast system

`05 § F8` specifies six messages, stacking, and placement — that is a queue with a provider, not a
single component.

```ts
// src/context/ToastContext.tsx
type Toast = { id: string; message: string; variant: 'success' | 'error' };

type ToastContextValue = {
  toasts: Toast[];
  show: (message: string, variant?: 'success' | 'error') => void;
  dismiss: (id: string) => void;
};
```

- Provider sits **inside** `QueryClientProvider` and outside `BrowserRouter`, so mutation callbacks
  and route components can both reach it.
- `show()` appends with a generated id and schedules dismissal at 4000ms. When the queue exceeds 3,
  the oldest is dropped immediately.
- `ToastViewport` renders the stack in a portal at `bottom-right` (desktop) / `bottom-center`
  (mobile), `role="status"` and `aria-live="polite"` so screen readers announce it without stealing
  focus.

**Wiring into mutations.** `useApplicationMutations` takes no toast dependency itself — it stays
pure and testable. The page supplies the callbacks:

```ts
const { show } = useToast();
const mutations = useApplicationMutations({
  onCreated: () => show('Application added.'),
  onUpdated: () => show('Changes saved.'),
  onDeleted: () => show('Application deleted.'),
  onStatusError: () => show("Couldn't update status. Please try again.", 'error'),
  onArchived: (undo) => show('Archived.', 'success', { label: 'Undo', onClick: undo }),
  onRestored: () => show('Restored.'),
  onImported: (n) => show(`Imported ${n} applications.`),
});
```

Successful `changeStatus` deliberately fires nothing — the card visibly moved
([05](./05-features-and-workflows.md) F8).

**Toasts with actions** (Undo, on archive) extend the type:

```ts
type ToastAction = { label: string; onClick: () => void };
type Toast = {
  id: string;
  message: string;
  variant: 'success' | 'error';
  action?: ToastAction;
};
```

An action toast still auto-dismisses at 4s — the archive is already committed, and Undo is a
convenience, not a confirmation. Hovering pauses the dismissal timer so the action stays reachable.

---

## Keyboard shortcuts

```ts
// src/hooks/useKeyboardShortcuts.ts
export function useKeyboardShortcuts(handlers: {
  onNew: () => void;
  onToggleView: (view: 'kanban' | 'table') => void;
  onFocusSearch: () => void;
}): void;
```

Mounted once in `ApplicationsPage`. Binds a single `keydown` listener on `document` and returns
early when the event target is an `input`, `textarea`, `select`, or any `contenteditable` — without
that guard, typing "n" in the company field opens a second modal.

`Esc` is **not** handled here; it belongs to whichever modal/drawer/drag is active, and a global
handler would fight them.

---

## UI primitive APIs

Visual treatment is in [04](./04-design-system.md); these are the contracts.

```ts
// Button
type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';  // default 'secondary'
  size?: 'sm' | 'md';                                            // default 'md'
  isLoading?: boolean;   // shows a spinner, sets disabled and aria-busy
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

// Input / Textarea / Select — all share this shape
type FieldProps = {
  label: string;         // always rendered above the control; never placeholder-as-label
  error?: string;        // renders the message and wires aria-invalid + aria-describedby
  required?: boolean;    // renders the * ; does NOT itself validate
  hint?: string;
};

// Modal
type ModalProps = {
  isOpen: boolean;
  onClose: () => void;          // callers may intercept for the dirty-form confirm
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnBackdrop?: boolean;    // default true; the dirty form passes false and handles it
};

// Drawer
type DrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

// ConfirmDialog
type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;        // default 'Confirm'
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
};

// EmptyState
type EmptyStateProps = {
  message: string;
  action?: { label: string; onClick: () => void };
};

// Skeleton
type SkeletonProps = { variant: 'card' | 'row'; count?: number };
```

`Modal` and `Drawer` both: render in a portal, trap focus, restore focus to the trigger on close,
close on `Esc`, and set `aria-modal="true"` with `aria-labelledby` pointing at the title.

---

## `types/application.ts`

```ts
import type { Application } from '../services/applicationsService';

// The form's shape differs from the row: no id/user_id/timestamps, and optional
// text fields are '' rather than null while the form is being edited.
export type ApplicationFormValues = {
  company_name: string;
  job_title: string;
  platform_source: PlatformSource;
  status: ApplicationStatus;
  job_link: string;
  salary_range: string;
  location: string;
  applied_date: string;
  notes: string;
};

export const toFormValues = (app?: Application): ApplicationFormValues => ({
  company_name: app?.company_name ?? '',
  job_title: app?.job_title ?? '',
  platform_source: app?.platform_source ?? 'jobstreet',
  status: app?.status ?? 'pending_application',
  job_link: app?.job_link ?? '',
  salary_range: app?.salary_range ?? '',
  location: app?.location ?? '',
  applied_date: app?.applied_date ?? todayISO(),
  notes: app?.notes ?? '',
});
```

`null → ''` on the way in, `'' → null` on the way out (in the service, per
[02](./02-backend-architecture.md)). Both directions in one file, so the asymmetry is visible.

---

## `lib/format.ts`

Three date renderings appear across the docs; this is which is used where.

```ts
// 'Sep 1'          — card meta row, current year only
export function formatCardDate(iso: string): string;

// 'Sep 1, 2026'    — table cells, drawer detail rows
export function formatDate(iso: string): string;

// 'Sep 3, 2:15 PM' — status timeline entries only
export function formatDateTime(iso: string): string;
```

**The `applied_date` timezone trap.** `applied_date` is a Postgres `date`, returned as
`"2026-09-01"`. `new Date("2026-09-01")` parses as **UTC midnight**, which renders as *August 31*
anywhere west of UTC — including the Philippines-adjacent case of a user travelling. Date-only
values must be parsed as local:

```ts
function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);   // local midnight, not UTC
}
```

`created_at` / `updated_at` / `changed_at` are `timestamptz` and are correctly parsed by
`new Date(...)` directly — the trap applies only to `applied_date`.

Locale is fixed to `en-US` via `Intl.DateTimeFormat`; salary is rendered verbatim as stored (it is
free text and may already contain a currency symbol — see [01](./01-database-schema.md)).

---

## `hooks/useMediaQuery.ts`

```ts
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);                   // resync in case it changed before effect ran
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
```

---

## `useStatusHistory`

The Detail Drawer may not call a service directly ([03](./03-frontend-architecture.md)), so the
timeline needs its own hook — this is the consumer of `queryKeys.applications.history`.

```ts
export function useStatusHistory(applicationId: string) {
  const query = useQuery({
    queryKey: queryKeys.applications.history(applicationId),
    queryFn: () => listForApplication(applicationId),
    enabled: Boolean(applicationId),
    staleTime: 60_000,          // history only changes when status changes
  });

  return {
    history: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
```

Because a status change writes a history row server-side, `changeStatus`'s `onSettled` must
invalidate `queryKeys.applications.all` (not just `lists`) so an open drawer's timeline updates —
this is the one place the broader key is correct.

---

## URL state: the setter details

`03 § Filter and sort state` shows the getters. The setters are where the real decisions are:

```ts
const setFilters = (next: Partial<ApplicationFilters>) => {
  const params = new URLSearchParams(searchParams);

  if (next.status !== undefined) {
    params.delete('status');
    next.status.forEach((s) => params.append('status', s));   // repeated key, not CSV
  }
  if (next.search !== undefined) {
    if (next.search) params.set('q', next.search);
    else params.delete('q');                                   // delete, never leave ?q=
  }
  // Filter changes REPLACE — a search burst must not create 12 back-button entries.
  setSearchParams(params, { replace: true });
};
```

| Decision | Choice | Why |
|---|---|---|
| Multi-value encoding | Repeated keys (`?status=a&status=b`) | `getAll()` reads it natively; no parse/serialize round-trip to get wrong |
| Empty values | Delete the param | `?q=` and no `q` must not be two different states |
| History entry | `replace: true` for filters/sort/view | Debounced search would otherwise poison Back with one entry per keystroke |
| History entry | `push` (default) for opening the drawer | Back closing the drawer is the entire point |
| Invalid values | Validated, not cast | See below |

**Validate, don't cast.** `03`'s getter shows `searchParams.getAll('status') as ApplicationStatus[]`
for brevity; a hand-edited `?status=bogus` would flow into `.in('status', [...])` and return
Postgres `22P02`. Filter values must be intersected against the known constants before use:

```ts
const status = searchParams.getAll('status').filter(
  (s): s is ApplicationStatus => STATUS_VALUES.includes(s as ApplicationStatus)
);
```

---

## Debounce placement

Search touches three things that can each be debounced independently; getting this wrong produces
either a laggy input or a URL that disagrees with the query.

| Layer | Debounced? |
|---|---|
| The `<input value>` | **No.** Local `useState`, updates on every keystroke — typing must feel instant |
| The URL write | **Yes**, 300ms, with `replace: true` |
| The query | **Follows the URL.** `useApplicationFilters` reads from the URL, so the query key changes only when the debounced write lands |

One debounce, on the URL write. The input is local state seeded from the URL and resynced when the
URL changes from elsewhere (e.g. "Clear filters").
