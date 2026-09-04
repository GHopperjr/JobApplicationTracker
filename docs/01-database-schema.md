# 01 — Database Schema

Everything in this project rests on this schema. It is deliberately small: one primary entity,
one supporting history table, one enum type, and a set of Row Level Security policies that make
per-user isolation a property of the database rather than a promise made by application code.

## Design principles

1. **One owner per row, enforced by the database.** Every user-owned table carries a `user_id`
   referencing `auth.users`, and every table has RLS enabled with policies that compare
   `auth.uid()` to that column. A bug in the frontend cannot leak another user's data, because
   the database itself will not return it.
2. **Status is an enum, not a free-text string.** Statuses drive the Kanban columns, the filters,
   and the workflow rules. A typo'd status would silently create a phantom column. Postgres enums
   make an invalid status a write-time error.
3. **Required fields are genuinely required; everything else is nullable.** Per the "under 15
   seconds to add" goal in [00](./00-overview.md), only company name, job title, platform, and
   status are `NOT NULL`. Salary, location, notes, and even the job link are optional.
4. **Status history is a separate table, not a JSON blob.** The Detail View shows a timeline of
   status changes. Storing that as an append-only table (rather than a JSONB array on the
   application) means it's queryable, indexable, and cannot be partially corrupted by a bad
   client-side merge.
5. **Timestamps are `timestamptz`, always.** Never bare `timestamp`. A job seeker may apply while
   travelling, and interview times are inherently timezone-sensitive.

## Enum types

```sql
create type application_status as enum (
  'pending_application',
  'scheduled_for_interview',
  'interviewed',
  'rejected',
  'accepted'
);
```

**Note on values:** stored values are `snake_case` identifiers, not display strings. Display
labels ("Pending Application", "Scheduled for Interview", …) live in the frontend
(`src/constants/status.ts`, see [03](./03-frontend-architecture.md)). This keeps display copy
changeable without a database migration, and keeps the enum values safe to use as object keys,
CSS class suffixes, and URL query parameters.

```sql
create type platform_source as enum (
  'jobstreet',
  'linkedin',
  'indeed',
  'company_website',
  'referral',
  'other'
);
```

**Why an enum rather than free text for platform:** the platform filter and any future
"response rate by platform" analysis both depend on consistent values. `'LinkedIn'`,
`'linkedin'`, and `'Linked In'` as three distinct free-text values would silently fragment that.
`'other'` is the escape hatch; if users frequently pick it, that's the signal to add a new enum
value in a migration.

## Table: `applications`

```sql
create table public.applications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,

  company_name      text not null check (char_length(trim(company_name)) > 0),
  job_title         text not null check (char_length(trim(job_title)) > 0),
  platform_source   platform_source not null,
  status            application_status not null default 'pending_application',

  job_link          text check (job_link is null or job_link ~* '^https?://'),
  salary_range      text,
  location          text,
  applied_date      date,
  notes             text,

  is_archived       boolean not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  status_changed_at timestamptz not null default now()
);
```

### Field notes

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `uuid` | yes (generated) | `gen_random_uuid()` — in core Postgres since v13, so no extension is needed on Supabase (which runs 15+). |
| `user_id` | `uuid` | yes | FK to `auth.users`. `on delete cascade` so deleting an account removes its data, satisfying a basic data-deletion expectation. |
| `company_name` | `text` | yes | `check` rejects empty/whitespace-only strings — a `not null` alone would still allow `''`. |
| `job_title` | `text` | yes | Same whitespace check rationale. |
| `platform_source` | `platform_source` | yes | See enum above. |
| `status` | `application_status` | yes | Defaults to `pending_application` — the correct starting state for a newly added application. |
| `job_link` | `text` | no | Validated at the database boundary with a case-insensitive regex requiring `http://` or `https://`. Full URL validation is deliberately *not* attempted in SQL (it's a famously bad idea); richer validation happens in the form layer — see [05](./05-features-and-workflows.md). This check exists to stop obviously-broken values like a pasted job ID. **Must be `null`, never `''`** — see the empty-string rule below. |
| `salary_range` | `text` | no | Deliberately **text, not numeric**. Real postings say "₱25,000–₱35,000/month", "Competitive", "DOE", "$60k–$80k USD". Forcing this into numeric columns would lose information and create a currency/period modeling problem far out of proportion to its value in v1. |
| `location` | `text` | no | Free text — "Makati City", "Remote", "Hybrid — BGC, 3 days onsite". Not normalized in v1. |
| `applied_date` | `date` | no | A `date`, not `timestamptz` — the calendar day is what matters, and users often backfill applications submitted days earlier. Nullable because an application may be tracked before it's actually submitted. |
| `notes` | `text` | no | Free-form. Interview details, contact names, follow-up reminders. Rendered as plain text with preserved line breaks — not markdown, not rich text, in v1. |
| `is_archived` | `boolean` | yes | Defaults `false`. Hides the row from the default view without deleting it — see the archive rationale below. |
| `created_at` / `updated_at` | `timestamptz` | yes | `updated_at` maintained by trigger (below), never trusted from the client. |
| `status_changed_at` | `timestamptz` | yes | When the status last actually changed. Maintained by trigger; drives stale-application detection ([05](./05-features-and-workflows.md), F10). |

### Why `is_archived` is a column, not a sixth status

Archiving is orthogonal to status: an application can be Rejected-and-visible or
Rejected-and-archived, and an Accepted one you want off the board is still Accepted. Modeling it as
a status value would make those states unrepresentable and would corrupt the Kanban columns (an
"Archived" column is not a pipeline stage). It also stays cleanly out of `status_history`, which
should record pipeline movement only.

### Why `status_changed_at` is a column, not a query against `status_history`

Staleness ("this has sat in the same stage for 14 days") is evaluated for *every card on every
render*. Deriving it would mean either joining `status_history` on every list query or fetching the
whole history table alongside the applications. A denormalized column maintained by the same trigger
that writes history keeps the list query a single flat select, and the two can never disagree
because one trigger sets both.

`updated_at` is deliberately **not** reused for this — editing a note would reset the staleness
clock, which is exactly wrong. Adding a note about an interview does not mean the application
progressed.

### The empty-string rule (applies to every optional field)

**Optional text fields must be written as `null`, never as `''`.** HTML inputs produce `''` when
cleared, so without an explicit normalization step this is the default — and it is wrong in three
separate ways:

1. **It breaks saves outright.** `''` is not `null` and does not match `^https?://`, so a `job_link`
   of `''` violates the check constraint and **every application saved without a job link fails**
   with a `23514` error. This is the single most likely bug to ship from this schema.
2. `applied_date` is a `date`; `''` is not a valid date literal and errors on insert.
3. The Detail View omits empty optional fields ([05](./05-features-and-workflows.md), F6). Two
   different "empty" representations mean two different code paths for the same visual outcome.

**Where it is enforced:** the service layer normalizes before every insert and update — see the
`normalizeOptionalFields` helper in [02](./02-backend-architecture.md). Not in the form, not in the
component: one place, at the boundary, so it cannot be forgotten by a future call site.

### `updated_at` trigger

Never let the client set `updated_at` — a client with a wrong clock, or one that simply forgets,
corrupts the ordering. Enforce it in the database:

```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();

  -- status_changed_at tracks pipeline movement only, so it advances when the
  -- status actually changes and stays put when a note or salary is edited.
  -- `is distinct from` (not <>) so a null-to-value transition also counts.
  if (new.status is distinct from old.status) then
    new.status_changed_at = now();
  end if;

  return new;
end;
$$;

create trigger applications_set_updated_at
  before update on public.applications
  for each row
  execute function public.set_updated_at();
```

This must be a `before` trigger — an `after` trigger cannot modify `new`. On insert, the column
default supplies `now()`, so no insert branch is needed.

## Table: `status_history`

Append-only record of every status transition, powering the timeline in the Detail View.

```sql
create table public.status_history (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.applications (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,

  from_status     application_status,
  to_status       application_status not null,
  changed_at      timestamptz not null default now()
);
```

**Why `user_id` is duplicated here** even though it's derivable via `application_id`: RLS policies
evaluate per-row without joins by default, and a policy that has to join to `applications` to
determine ownership is both slower and easier to get wrong. Denormalizing `user_id` onto this
table lets its RLS policy be the same trivial `auth.uid() = user_id` check as every other table.
The trigger below keeps it correct, so it can never drift from the parent row.

**`from_status` is nullable** — the first row for any application (its creation) has no previous
status.

### Automatic history capture

History is written by a trigger, not by the client. If the client were responsible, a status
change made from any other source (a SQL console, a future mobile app, a bulk update) would
silently skip the timeline.

```sql
create or replace function public.record_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (TG_OP = 'INSERT') then
    insert into public.status_history (application_id, user_id, from_status, to_status)
    values (new.id, new.user_id, null, new.status);
  elsif (TG_OP = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.status_history (application_id, user_id, from_status, to_status)
    values (new.id, new.user_id, old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger applications_record_status_change
  after insert or update on public.applications
  for each row
  execute function public.record_status_change();
```

`is distinct from` (rather than `<>`) correctly handles nulls and means an update that touches
only `notes` writes no history row — the timeline stays a record of *status* changes only.

## Indexes

```sql
-- The single most common query: "all of my ACTIVE applications, newest first."
-- Partial on is_archived = false, because that is the default view and archived
-- rows are a minority that is only ever read deliberately.
create index applications_user_active_idx
  on public.applications (user_id, created_at desc)
  where is_archived = false;

-- The archive view — small, but should not fall back to a sequential scan.
create index applications_user_archived_idx
  on public.applications (user_id, created_at desc)
  where is_archived = true;

-- Kanban board grouping and status filtering.
create index applications_user_status_idx
  on public.applications (user_id, status);

-- Table view's platform filter.
create index applications_user_platform_idx
  on public.applications (user_id, platform_source);

-- Duplicate detection on add: "does this user already have this company + title?"
-- Not a unique constraint — applying to the same role via two platforms is a real,
-- legitimate case. This index supports the warning, it does not enforce anything.
create index applications_user_company_title_idx
  on public.applications (user_id, lower(company_name), lower(job_title));

-- Timeline lookup for one application's Detail View.
create index status_history_application_idx
  on public.status_history (application_id, changed_at desc);

-- status_history's RLS policy filters on user_id, so that predicate needs support too.
create index status_history_user_idx
  on public.status_history (user_id);
```

**Every index on `applications` is `user_id`-first.** Because RLS scopes every query to one user,
`user_id` is effectively an implicit predicate on all traffic — a leading `user_id` column makes
each index usable for the queries that actually run. An index on `(status)` alone would be
near-useless here.

`status_history` is the exception: its dominant query is "the timeline for this one application,"
which is already narrowed by `application_id`, so that column leads. Its `user_id` index exists
purely to support the RLS predicate.

**Deliberately not indexed in v1:** `company_name` / `job_title` text search. At the expected data
scale (a few hundred rows per user at most), Postgres will sequential-scan these faster than it
would traverse an index. If a user ever exceeds a few thousand applications, add a
`pg_trgm` GIN index at that point — not before.

## Row Level Security

RLS is the entire authorization model for this application. There is no server-side code checking
permissions, because there is no server — so these policies are not a defense-in-depth layer, they
are *the* defense.

```sql
alter table public.applications   enable row level security;
alter table public.status_history enable row level security;
```

### `applications` policies

```sql
create policy "Users can read their own applications"
  on public.applications for select
  using (auth.uid() = user_id);

create policy "Users can insert their own applications"
  on public.applications for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own applications"
  on public.applications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own applications"
  on public.applications for delete
  using (auth.uid() = user_id);
```

**Why `update` needs both `using` and `with check`:** `using` decides which rows the user may
*attempt* to update; `with check` validates the row *after* the update is applied. Without the
`with check` clause, a user could take one of their own rows and reassign its `user_id` to
somebody else — writing a row into another user's account. This is the single most commonly
missed RLS mistake and it must not be omitted here.

### `status_history` policies

```sql
create policy "Users can read their own status history"
  on public.status_history for select
  using (auth.uid() = user_id);
```

**Only `select` is granted.** History rows are written exclusively by the
`record_status_change()` trigger. No client is ever permitted to insert, update, or delete a
history row — that makes the timeline genuinely append-only and tamper-proof from the
application's perspective, which is the entire point of keeping it as a separate table.

**Why the trigger's insert succeeds despite no insert policy** — and this precision matters:
`security definer` alone does *not* bypass RLS. The function runs as its owner, and a table's
owner is exempt from that table's RLS policies unless `force row level security` is set. So the
insert works because of *owner exemption*, not because of `security definer` per se.

**Consequence to remember:** if anyone later runs
`alter table public.status_history force row level security` as a hardening measure, the trigger's
insert will start failing — and because the trigger fires on every `applications` insert and
update, **every write to `applications` would break with it.** If you ever need `force row level
security` here, add an explicit insert policy for the function's role at the same time.

## Migrations

Use the Supabase CLI's migration workflow rather than editing schema through the dashboard UI, so
that the schema is versioned in git alongside the code that depends on it.

```
supabase/
  migrations/
    20260904000001_create_enums.sql
    20260904000002_create_applications.sql        # table + indexes + RLS enable + policies + triggers
    20260904000003_create_status_history.sql      # table + indexes + RLS enable + policies + trigger
    20260904000004_enable_realtime.sql            # publication + replica identity (see doc 02)
```

**Each table's migration is self-contained** — it creates the table, its indexes, its triggers,
enables RLS, *and* creates its policies, all in one file. This is not a stylistic preference; see
the rule below. A separate "enable RLS later" migration would leave a window, however brief, where
the table is exposed through the auto-generated API.

**Rules for migrations in this project:**

- One logical change per migration file; never edit a migration that has been applied to the
  hosted project — write a new one.
- Every migration that creates a user-facing table must, in the *same* file, enable RLS and
  create its policies. A table that exists for even one deploy without RLS enabled is a table that
  was briefly world-readable through the auto-generated API.
- Destructive changes (dropping a column, changing an enum value) need an explicit note in the
  migration's leading comment explaining the data implication, since Supabase applies these
  against a live database.

## Generated TypeScript types

Supabase can generate types directly from the live schema — this is the mechanism that makes the
frontend's type safety real rather than hand-maintained:

```bash
supabase gen types typescript --project-id <project-id> > src/types/database.types.ts
```

Regenerate this file after every migration and commit it. [03](./03-frontend-architecture.md)
covers how these generated types flow into the service layer and hooks, so a schema change
surfaces as a compile error in every place that consumed the changed field.

## Seed data for local development

```sql
-- Only for local development; never run against the hosted project.
insert into public.applications
  (user_id, company_name, job_title, platform_source, status, job_link, salary_range, location, applied_date, notes)
values
  ('<local-test-user-uuid>', 'Acme Corp', 'Junior Backend Developer', 'jobstreet',
   'pending_application', 'https://www.jobstreet.com.ph/job/12345678', '₱25,000 – ₱32,000/month',
   'Makati City', current_date - 3, 'Applied through JobStreet quick apply.'),
  ('<local-test-user-uuid>', 'Globex', 'Cloud Engineer (Entry Level)', 'linkedin',
   'scheduled_for_interview', 'https://www.linkedin.com/jobs/view/87654321', 'Competitive',
   'Remote (PH)', current_date - 10, 'Initial screening call went well. Technical interview set for Friday 2PM.'),
  ('<local-test-user-uuid>', 'Initech', 'Software Engineer I', 'indeed',
   'rejected', 'https://ph.indeed.com/viewjob?jk=abcdef', null, 'Taguig City',
   current_date - 21, 'Rejected after final round — feedback was they wanted more .NET experience.');
```

---

Next: [02 — Backend Architecture](./02-backend-architecture.md), which covers how this schema is
actually reached from the client, what authorization looks like in practice, and where
server-side logic lives when there is no server.
