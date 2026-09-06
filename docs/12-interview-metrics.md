# 12 — Interview Metrics

The second post-roadmap feature, built after [11](./11-navigation-and-distance.md). It adds one
page, reachable from the sidebar that doc 11 introduces, and answers three questions a person
actually asks themselves during a job search.

---

## Scope

**The three questions this page answers**, and nothing else:

| Question | Section |
|---|---|
| *Am I applying enough?* | Monthly goal + count for the selected period |
| *Is my approach working?* | Status snapshot + conversion funnel |
| *Where should I spend my effort?* | Effectiveness by platform |

**Explicitly not in scope:**

- **Charts.** No charting library, no line/pie/donut graphs. Numeric cards and CSS bars only — see
  *Why no charting library*.
- **Time-to-response and "what's gone quiet".** Deliberately dropped: Phase 7's stale detection
  ([06](./06-implementation-roadmap.md)) already owns "this has been sitting too long," and a second
  surface answering the same question would drift out of agreement with the first.
- **Any cross-user comparison or benchmarking.** There is one user's data and no cohort to compare
  against.

### This is not the analytics that [09](./09-operations.md) rules out

[09](./09-operations.md) states plainly: *"No product analytics. No PostHog, no Plausible, no event
tracking."* That still holds and is not contradicted here.

That rule is about **telemetry on the user** — instrumenting their behaviour to study them. This
page is the opposite direction: it reads data the user typed in themselves and shows it back to
them. Nothing is collected, nothing is transmitted, no third party is involved, and no event is
recorded that did not already exist as a row the user created.

---

## Why no charting library

A charting dependency was considered and rejected. Three reasons, in order of weight:

1. **The data is too sparse to need one.** A personal job search produces dozens of applications
   over a few months — not a series where trend lines reveal anything a number doesn't.
2. **Usage is bursty and terminal.** This tool is used intensely for a few weeks and then, once a
   job is found, essentially never again. Investment in dense visualisation is paid for daily and
   returned rarely.
3. **It fights the design system.** [04](./04-design-system.md) commits to restrained colour, no
   decorative chrome, and colour that carries meaning rather than decoration. Chart libraries arrive
   with their own palettes and visual conventions, and bending one into this system costs more than
   drawing five bars with `div`s.

Everything on this page is a number, a percentage, or a horizontal bar built from existing
primitives.

---

## The cohort model

One idea holds the whole page together.

**A period selector defines a cohort — applications whose `created_at` falls in the selected range —
and every section computes over that same cohort.**

**The cohort includes archived applications.** Archiving hides an application from the active
board and table (docs/06's Phase 7), it does not erase that it happened — an application archived
after being rejected still counts toward "Applied" and, if it was interviewed first, still reached
that stage. The funnel is a historical accounting of a job search, the same "history is the whole
truth" philosophy `status_history` already applies; a metrics page that quietly excluded archived
rows would undercount both without any visible sign that it had.

| Period | Cohort |
|---|---|
| This Month | Applications created in the current calendar month |
| Last 30 Days | Applications created in the last 30×24h |
| All Time | Every application |

Because there is exactly one cohort, no two sections can disagree about what "the data" means. The
status snapshot, the funnel, and the platform breakdown are three views of the same set of rows, and
their totals always reconcile.

**The selected period lives in the URL** (`/metrics?period=month`), matching the state-location rule
[03](./03-frontend-architecture.md) sets for filters, sort, and view: anything that changes what is
on screen and is worth surviving a refresh belongs in the query string.

Default period is **This Month** — the one that pairs with the goal, and the one that answers the
question a person opens this page to ask.

---

## Data model

One new table. Everything else on this page is derived from data that already exists.

```sql
create table public.user_preferences (
  user_id                   uuid primary key references auth.users (id) on delete cascade,
  monthly_application_goal  integer check (monthly_application_goal > 0),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table public.user_preferences
  alter column user_id set default auth.uid();
```

**`user_id` is the primary key, not a separate `id` with a unique constraint.** This is a
singleton-per-user row, and making that the table's shape means "two preference rows for one user"
is unrepresentable rather than merely disallowed.

RLS follows the same pattern as every other table — enabled in the same migration, `update` carrying
both `using` and `with check` ([02](./02-backend-architecture.md)):

```sql
alter table public.user_preferences enable row level security;

create policy "Users can read their own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert their own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

No delete policy — clearing a goal sets the column to `null`, it does not remove the row.

The same `set_updated_at` before-trigger used elsewhere is attached here too.

### On the table's name

It is `user_preferences`, not `metrics_settings`, deliberately. Doc 13's profile fields
(fresh-grad / experienced categorisation) will want a per-user singleton row of exactly this shape.
Extending this table with a column later is a one-line migration; discovering then that a second
near-identical one-row-per-user table already exists is a schema smell that never fully goes away.

This is a naming decision, not speculative building — no column exists here that this feature does
not use.

---

## Computation

**All aggregation happens client-side.** No Postgres views, no RPC functions, no server-side
aggregation — consistent with [02](./02-backend-architecture.md)'s position that Supabase *is* the
backend and RLS is the only authorization boundary. The dataset is bounded to the same scale the
rest of the app already assumes (a few hundred rows at most, matching the 500-row cap
`listApplications` already imposes), so pulling it and reducing it in memory is both simpler and
sufficient.

Two reads feed the page:

| Source | Query | Used for |
|---|---|---|
| `applications` | The existing `useApplications` fetch, already cached | Cohort, status snapshot, platform volumes |
| `status_history` | One new query: all history rows for the user | "Reached interview stage" per application |

The status snapshot reuses grouping the app already does — `useApplications` computes `byStatus` for
the Kanban board today, and the same shape answers "how many are in each status" here.

### The problem the funnel actually solves

**Current status hides history.** An application sitting at `rejected` today may well have been
interviewed last week — that is the single most common path through a job search. Counting the
funnel from `applications.status` alone would report that interview as never having happened, and
the resulting number would be wrong in a way that looks entirely plausible.

`status_history` is what makes the honest version possible, and it is **complete**: the
`record_status_change` trigger fires on `INSERT` as well as `UPDATE`
([01](./01-database-schema.md)), so every application has a history row for its initial status plus
one per transition. There is no need to union history against current status — history alone is the
whole truth.

```
Application:   status = 'rejected'                    ← current state only
status_history: → pending_application  (created)
                → scheduled_for_interview
                → interviewed                         ← this is what the funnel counts
                → rejected
```

### Funnel stage definitions

Three stages, defined as **sets of statuses ever reached**, not as positions in an ordering:

| Stage | Counted when history contains `to_status` in | Always |
|---|---|---|
| Applied | *(every application in the cohort)* | 100% |
| Reached interview stage | `scheduled_for_interview`, `interviewed`, `accepted` | ≤ Applied |
| Offer accepted | `accepted` | ≤ Reached interview stage |

**"Reached interview stage" rather than "interviewed"** — the label is precise on purpose. Being
scheduled counts: from the applicant's point of view, an interview secured but not yet held is
still an interview obtained, and waiting for the date to pass before counting it would make the
metric lag reality by weeks.

**Each stage's set includes the stages beyond it**, which makes the funnel monotonic by
construction. This matters because the app permits arbitrary status changes (the table's inline
select lets any status move to any other), so a user *can* jump an application straight from
Pending to Accepted. Under strict counting that produces a funnel where "accepted" exceeds
"interviewed" — visually broken and, worse, apparently a bug. Treating a reached `accepted` as
implying the stage before it costs a small fiction in a rare case and buys a funnel that always
reads correctly.

**`rejected` is not a funnel stage.** It is an outcome, not a depth — an application can be rejected
from any point, and putting it in the sequence would imply everything passes through it.

### Platform effectiveness

The same reached-interview-stage flag, grouped by `platform_source`:

```
JobStreet    12 applied · 25% reached interview
LinkedIn      8 applied · 50% reached interview
Referral      2 applied · 100% reached interview
```

**Sorted by volume descending**, so the platforms carrying real weight appear first and a single
lucky referral does not head the list at 100%.

Platforms with zero applications in the cohort are omitted entirely rather than listed at 0% —
a platform never used is not a platform performing badly.

---

## Page layout

One consistent example throughout: a cohort of 22 applications, of which 9 ever reached the
interview stage (7 sitting there or beyond right now, plus 2 that were interviewed before being
rejected) and 2 became offers.

```
┌───────────────────────────────────────────────────────────────────┐
│  Interview Metrics                                                │
│  [ This Month │ Last 30 Days │ All Time ]                         │
├───────────────────────────────────────────────────────────────────┤
│  22 of 25 applications this month                                 │
│  ██████████████████████░░░                                        │
├───────────────────────────────────────────────────────────────────┤
│  Pending 8    Scheduled 2   Interviewed 3   Rejected 7  Accepted 2│
│  36%          9%            14%             32%         9%        │
├───────────────────────────────────────────────────────────────────┤
│  Applied              22    ████████████████████  100%            │
│  Reached interview     9    ████████              41%             │
│  Offer accepted        2    ██                     9%             │
├───────────────────────────────────────────────────────────────────┤
│  JobStreet   12 applied · 25% reached interview                   │
│  LinkedIn     8 applied · 50% reached interview                   │
│  Referral     2 applied · 100% reached interview                  │
└───────────────────────────────────────────────────────────────────┘
```

**The two halves must reconcile, and checking that they do is the fastest way to catch a broken
implementation.** Here: the snapshot's interview-or-later statuses (2 + 3 + 2 = 7) plus the 2
rejected applications that were interviewed first equals the funnel's 9. Per-platform reached counts
(3 + 4 + 2) equal the same 9. If a build ever shows a funnel number *below* the count currently
sitting in interview-or-later statuses, the funnel is being computed from current status rather than
from history.

**The period selector reuses `SegmentedToggle`** — the shared component already backing the
Board/Table switch and the login page's sign-in/sign-up toggle. Three options instead of two; no new
UI idiom, no new component.

**Status snapshot cards** carry the status dot colour already defined in
[04](./04-design-system.md)'s `STATUS_STYLES`, so a status looks the same here as it does on a card,
a badge, and a column header.

**Percentages are whole numbers** (`40%`, not `40.0%`). One decimal implies a precision that 20 data
points do not have.

### The goal

- Shown **only when the period is This Month.** A monthly goal against "Last 30 Days" is
  off-by-a-few-days nonsense, and against "All Time" it is meaningless. Those periods show a plain
  count instead.
- **When no goal is set**, the bar is replaced by a single quiet line: *"Set a monthly goal"*,
  linking to Settings. Shown once, inline, not as a recurring prompt — motivating, per the reason
  the goal exists at all, without nagging.
- Editing lives in **Settings**, alongside doc 11's saved locations — one page for the handful of
  things a user configures, rather than settings scattered across the surfaces that consume them.
- The bar does not cap at 100%: exceeding a goal shows a full bar and the real numbers (`24 of 20`).
  Beating the target should read as beating it.

### Empty states

| Situation | Shown |
|---|---|
| No applications at all | A single empty state: *"No applications yet."* with a link to Job Applications. Not a page of zeroes. |
| No applications *in this period* | *"No applications in this period."* plus the period selector, so the user can widen it |
| Goal set, zero applications this month | The goal bar, empty, at `0 of 20` — this is a real and motivating state, not an empty one |

**A cohort of zero must never reach a percentage calculation.** Every derived percentage guards its
denominator; `0/0` renders as an empty state, never as `NaN%` and never as `0%`.

---

## Code structure

Following [03](./03-frontend-architecture.md)'s layering — services do I/O, hooks own cache and
state, components render:

| File | Responsibility |
|---|---|
| `lib/metrics.ts` | **All computation.** Pure functions over arrays: `computeStatusBreakdown`, `computeFunnel`, `computePlatformBreakdown`, `reachedInterviewStage`. No I/O, no React |
| `services/statusHistoryService.ts` | Gains `listStatusHistory()` — every history row for the user, RLS-scoped. The existing per-application function stays as it is |
| `hooks/useMetrics.ts` | Joins the cohort-filtered applications and the history query, memoizes the derived metrics |
| `hooks/useUserPreferences.ts` | Read/upsert the goal |
| `hooks/useMetricsPeriod.ts` | The `?period=` URL parameter, validated not cast — the same treatment `useApplicationFilters` gives `?status=` |
| `pages/MetricsPage.tsx` | Composition only |
| `components/metrics/` | `PeriodSelector`, `GoalProgress`, `StatusBreakdown`, `FunnelBars`, `PlatformBreakdown` |

**`lib/metrics.ts` holding every calculation as a pure function is the load-bearing decision here.**
The interesting logic on this page is arithmetic over arrays — exactly the kind of thing that is
cheap to test exhaustively and expensive to debug once it is entangled with rendering. Components on
this page should contain no arithmetic beyond formatting.

---

## Testing

Extending [08](./08-testing-and-ci.md). This feature is unusually unit-testable — take advantage of
that rather than reaching for component tests to cover logic.

**Unit — where nearly all the value is:**

- An application currently `rejected` whose history contains `interviewed` **counts** as having
  reached the interview stage.
- An application that jumped `pending_application → accepted` counts in **both** later stages —
  monotonicity holds.
- Funnel percentages against an empty cohort return an empty-state marker, not `NaN`.
- `computePlatformBreakdown` sorts by volume descending and omits unused platforms.
- Period boundaries: an application created on the first instant of the month is in This Month; one
  created a second earlier is not.

**Service (mocked client):** `listStatusHistory` requests all rows for the user without an
application filter, and returns `[]` rather than throwing on error.

**Component:** the goal bar renders the prompt when no goal is set, the bar when one is; percentages
render as whole numbers.

**Non-negotiable, in [08](./08-testing-and-ci.md)'s sense of the term:**

> **A rejected application that was once interviewed still counts in the funnel.** This is the entire
> reason `status_history` is consulted instead of `applications.status`. Computed the naive way, this
> number is wrong and looks completely reasonable — no error, no crash, just a quietly understated
> interview rate that would lead a user to the wrong conclusion about their own job search.

---

## Traps

- **Never use enum ordinal comparison for "reached at least stage X".** `application_status` is
  declared `pending_application, scheduled_for_interview, interviewed, rejected, accepted` — so
  `rejected` sorts *after* `interviewed` despite not implying it, and `accepted` sorts last despite
  being reachable directly. Depth must be expressed as explicit sets of statuses, never as `>=`.
- **Do not compute the funnel from `applications.status`.** See the non-negotiable test above.
- **Do not union history against current status.** The trigger fires on `INSERT`, so history is
  already complete; adding a union invites double-counting.
- **Guard every denominator.** Empty cohorts are the normal state for a new user and for a narrow
  period.
- **Percentages are relative to the cohort, not to all-time.** Mixing the two makes sections
  silently disagree.
- **The goal is monthly and only rendered for This Month.** Prorating it across other periods was
  considered and rejected as false precision.

---

Next: doc 13, the profile and fresh-grad/experience categorisation — still exploratory.
