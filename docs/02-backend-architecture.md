# 02 — Backend Architecture

## The core idea: there is no server

This project runs no backend process of its own. Supabase exposes the PostgreSQL database from
[01](./01-database-schema.md) through an auto-generated REST API (PostgREST), and Row Level
Security decides what each authenticated caller may see and do. The React app talks to that API
directly through the official `supabase-js` client.

This is a significant architectural difference from the reference project, which routes every
request through a Lambda handler that authenticates, authorizes, and then calls a domain layer.
**What carries over is the discipline, not the topology:**

| Reference project (Lambda) | This project (Supabase) |
|---|---|
| Handler validates the JWT on every request | Supabase validates the JWT before the query reaches Postgres |
| Handler resolves user scope, domain layer filters queries by it | RLS policies filter every query by `auth.uid()` at the database |
| Domain layer holds business logic, handlers stay thin | Service layer + hooks hold logic, components stay thin |
| One shared `api.js` axios client with an auth interceptor | One shared Supabase client instance with session handling built in |
| Store modules (`responses_store.py`) own all DynamoDB access | `applicationsService.ts` owns all Supabase access |

The rule that matters is the same one in both: **no component, page, or view ever talks to the
data source directly.** Everything goes through one module, so authorization, error shape, and
data mapping have exactly one home.

## Authentication

Supabase Auth issues a JWT on sign-in and `supabase-js` attaches it to every subsequent request
automatically. Postgres reads the user's id from that token via `auth.uid()`, which is what every
RLS policy compares against.

**v1 auth method: email + password**, with Supabase's built-in email confirmation flow. Magic
links and OAuth providers (Google, GitHub) are straightforward to add later — they change nothing
about the data model or RLS, only the sign-in screen — but v1 keeps a single well-understood path.

### Session handling

```ts
// src/services/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill both values.'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,      // survive a page reload
    autoRefreshToken: true,    // refresh before expiry, no surprise 401s mid-session
    detectSessionInUrl: true,  // needed for email-confirmation and future OAuth redirects
  },
});
```

**This is the only place `createClient` is ever called.** Every other module imports `supabase`
from here — the direct analogue of the reference project's single `api.js` axios instance.
Creating a second client elsewhere would produce a second, independently-refreshing session and
is the kind of subtle bug that only shows up as random logouts in production.

### On the anon key being public

`VITE_SUPABASE_ANON_KEY` ships to the browser and is *designed* to be public. It grants nothing on
its own — it only identifies the project. All actual authorization comes from the user's JWT and
the RLS policies. **The `service_role` key, by contrast, bypasses RLS entirely and must never
appear in frontend code, in `.env` files that are committed, or in any `VITE_`-prefixed variable**
(Vite inlines every `VITE_` variable into the client bundle). If server-side privileged work is
ever needed, it belongs in an Edge Function where that key stays server-side.

## The service layer

All database access lives in `src/services/`. Components and hooks never call `supabase.from(...)`
directly.

```
src/services/
  supabaseClient.ts        # the single client instance (above)
  applicationsService.ts   # all CRUD for the applications table
  statusHistoryService.ts  # read-only timeline queries
  authService.ts           # sign in / sign up / sign out / session access
  realtimeService.ts       # postgres_changes subscription
  errors.ts                # AppError + normalization from Supabase/Postgres errors
```

### `applicationsService.ts` — shape and conventions

```ts
import { supabase } from './supabaseClient';
import type { Database } from '../types/database.types';

export type Application = Database['public']['Tables']['applications']['Row'];
export type ApplicationInsert = Database['public']['Tables']['applications']['Insert'];
export type ApplicationUpdate = Database['public']['Tables']['applications']['Update'];

export type ApplicationFilters = {
  status?: Application['status'][];
  platform?: Application['platform_source'][];
  search?: string;
  /** 'active' (default) | 'archived' | 'all'. Archived rows are excluded unless asked for. */
  archived?: 'active' | 'archived' | 'all';
};

export type SortField = 'company_name' | 'job_title' | 'status' | 'platform_source' | 'applied_date' | 'created_at';

export type ApplicationSort = {
  field: SortField;
  direction: 'asc' | 'desc';
};

export const DEFAULT_SORT: ApplicationSort = { field: 'created_at', direction: 'desc' };

/**
 * PostgREST's `or=` takes a RAW filter string — supabase-js does no escaping of it.
 * An unescaped comma, parenthesis, or quote in user input breaks the parse (HTTP 400)
 * or injects extra conditions. Wrapping the value in double quotes and escaping
 * embedded quotes/backslashes is mandatory, not optional.
 *
 * Without this, searching for a company named `Acme, Inc` returns a 400.
 */
function escapeOrFilterValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export async function listApplications(
  filters: ApplicationFilters = {},
  sort: ApplicationSort = DEFAULT_SORT
): Promise<Application[]> {
  let query = supabase.from('applications').select('*');

  // Archived rows are excluded by default. Every list surface in the app reads
  // through here, so the exclusion cannot be forgotten by an individual caller.
  const archived = filters.archived ?? 'active';
  if (archived === 'active') query = query.eq('is_archived', false);
  else if (archived === 'archived') query = query.eq('is_archived', true);

  if (filters.status?.length) query = query.in('status', filters.status);
  if (filters.platform?.length) query = query.in('platform_source', filters.platform);

  if (filters.search) {
    const term = escapeOrFilterValue(`%${filters.search}%`);
    query = query.or(`company_name.ilike.${term},job_title.ilike.${term}`);
  }

  // `status` sorts correctly with a plain column order: Postgres enums sort by
  // DECLARATION order, and application_status is declared in pipeline order in
  // doc 01 — so this yields Pending → Scheduled → Interviewed → Rejected → Accepted
  // with no CASE expression (which PostgREST could not express anyway).
  query = query.order(sort.field, {
    ascending: sort.direction === 'asc',
    nullsFirst: false, // applied_date is nullable; keep undated rows last either way
  });

  // Stable tiebreak so equal sort values don't reorder between fetches.
  if (sort.field !== 'created_at') {
    query = query.order('created_at', { ascending: false });
  }

  // PostgREST caps rows server-side (default 1000). Be explicit rather than
  // silently truncating; see "Scale limits" below.
  query = query.limit(500);

  const { data, error } = await query;
  if (error) throw toAppError(error);
  return data ?? [];
}

/**
 * Coerce '' → null on every optional field before it reaches Postgres.
 * See the empty-string rule in doc 01 — without this, saving an application
 * with no job link violates the check constraint and fails outright.
 */
const OPTIONAL_FIELDS = ['job_link', 'salary_range', 'location', 'applied_date', 'notes'] as const;

function normalizeOptionalFields<T extends Record<string, unknown>>(input: T): T {
  const out = { ...input };
  for (const field of OPTIONAL_FIELDS) {
    if (field in out && typeof out[field] === 'string' && out[field].trim() === '') {
      (out as Record<string, unknown>)[field] = null;
    }
  }
  return out;
}

export async function createApplication(input: ApplicationInsert): Promise<Application> {
  const { data, error } = await supabase
    .from('applications')
    .insert(normalizeOptionalFields(input))
    .select()
    .single();

  if (error) throw toAppError(error);
  return data;
}

export async function updateApplication(
  id: string,
  patch: ApplicationUpdate
): Promise<Application> {
  const { data, error } = await supabase
    .from('applications')
    .update(normalizeOptionalFields(patch))
    .eq('id', id)
    .select()
    .single();

  if (error) throw toAppError(error);
  return data;
}

/**
 * Bulk status change — ONE request, not N. Used by the table's bulk actions.
 * Running N concurrent single-row optimistic mutations corrupts rollback
 * (each snapshots a cache already containing the others' writes), so the
 * bulk path deliberately does not reuse changeStatus per row.
 */
export async function bulkUpdateStatus(
  ids: string[],
  status: Application['status']
): Promise<Application[]> {
  const { data, error } = await supabase
    .from('applications')
    .update({ status })
    .in('id', ids)
    .select();

  if (error) throw toAppError(error);
  return data ?? [];
}

export async function bulkDelete(ids: string[]): Promise<void> {
  const { error } = await supabase.from('applications').delete().in('id', ids);
  if (error) throw toAppError(error);
}

export async function setArchived(ids: string[], isArchived: boolean): Promise<Application[]> {
  const { data, error } = await supabase
    .from('applications')
    .update({ is_archived: isArchived })
    .in('id', ids)
    .select();

  if (error) throw toAppError(error);
  return data ?? [];
}

/**
 * Duplicate detection for the add form — a WARNING, never a block.
 * Applying to the same role through two platforms is legitimate and common,
 * so this deliberately has no unique constraint behind it (see doc 01).
 *
 * Matches case-insensitively on company AND title, and includes archived rows:
 * "you already applied and archived it" is exactly the case worth surfacing.
 */
export async function findPotentialDuplicates(
  companyName: string,
  jobTitle: string,
  excludeId?: string
): Promise<Application[]> {
  const company = companyName.trim();
  const title = jobTitle.trim();
  if (!company || !title) return [];

  let query = supabase
    .from('applications')
    .select('*')
    .ilike('company_name', company)
    .ilike('job_title', title)
    .limit(5);

  if (excludeId) query = query.neq('id', excludeId);   // edit mode: don't match yourself

  const { data, error } = await query;
  if (error) throw toAppError(error);
  return data ?? [];
}

/**
 * Bulk insert for CSV import (doc 10). Chunked because PostgREST request bodies
 * are size-limited and a 500-row insert in one request risks a timeout on a cold
 * connection. Chunks are sequential, not parallel: a partial failure should stop
 * cleanly rather than leave an unknown subset written.
 */
export async function bulkCreate(rows: ApplicationInsert[]): Promise<Application[]> {
  const CHUNK = 100;
  const created: Application[] = [];

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map(normalizeOptionalFields);
    const { data, error } = await supabase.from('applications').insert(chunk).select();

    if (error) {
      // Report how far we got — doc 10 surfaces this as "imported N of M".
      throw new PartialImportError(toAppError(error), created.length, rows.length);
    }
    created.push(...(data ?? []));
  }

  return created;
}

export async function updateApplicationStatus(
  id: string,
  status: Application['status']
): Promise<Application> {
  // Dedicated function rather than a generic update: this is the single most
  // frequent write in the app (every Kanban drag), it is the one write with a
  // database-side side effect (the status_history trigger), and giving it its
  // own name makes the optimistic-update path in useApplications explicit.
  return updateApplication(id, { status });
}

export async function deleteApplication(id: string): Promise<void> {
  const { error } = await supabase.from('applications').delete().eq('id', id);
  if (error) throw toAppError(error);
}
```

### Conventions every service function follows

1. **Never pass `user_id` from the client on insert.** It is set by a database default (below), so
   the client physically cannot write a row into someone else's account, and RLS's `with check`
   would reject it anyway.

   ```sql
   -- Add to the applications table migration:
   alter table public.applications
     alter column user_id set default auth.uid();
   ```

2. **Throw, don't return, errors.** `supabase-js` returns `{ data, error }` rather than throwing.
   Every service function unwraps that and throws a normalized `AppError`, so callers (and
   TanStack Query) get one consistent failure mode instead of each call site remembering to check
   `error`.

3. **Return domain data, not envelopes.** Callers get `Application[]`, never
   `{ data, error, count }`. The Supabase response shape stops at the service boundary — the same
   way the reference project's `_unwrap` keeps the upstream `{success, data}` envelope from
   leaking into its domain layer.

4. **One function, one intent.** `updateApplicationStatus` exists separately from
   `updateApplication` even though it delegates to it, because a status change is a semantically
   distinct operation with different caching and optimistic-update behavior.

### `statusHistoryService.ts`

```ts
import { supabase } from './supabaseClient';
import { toAppError } from './errors';
import type { Database } from '../types/database.types';

export type StatusHistory = Database['public']['Tables']['status_history']['Row'];

export async function listForApplication(applicationId: string): Promise<StatusHistory[]> {
  const { data, error } = await supabase
    .from('status_history')
    .select('*')
    .eq('application_id', applicationId)
    .order('changed_at', { ascending: false });

  if (error) throw toAppError(error);
  return data ?? [];
}
```

Read-only by design — there is no insert/update/delete function here, because the table grants no
such policy ([01](./01-database-schema.md)). If a future feature appears to need one, that is a
signal the trigger should be doing the work instead.

### `authService.ts`

```ts
import { supabase } from './supabaseClient';
import { AppError } from './errors';
import type { Session, User } from '@supabase/supabase-js';

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw toAuthError(error);
}

export async function signUp(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/login` },
  });
  if (error) throw toAuthError(error);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw toAuthError(error);
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
```

**`emailRedirectTo` is required**, and it is the single most common Supabase launch failure: without
it (and without matching Redirect URLs configured in the dashboard, see below) confirmation emails
sent from production redirect users to `localhost`.

### Auth error mapping

Supabase `AuthError` does **not** carry Postgres error codes, so `toAppError` cannot classify it —
auth failures need their own mapping, or every one of them degrades to "Something went wrong":

```ts
// src/services/errors.ts
export function toAuthError(error: { message: string; status?: number }): AppError {
  const msg = error.message.toLowerCase();

  // Deliberately identical message for bad password AND unknown email:
  // distinguishing them lets an attacker enumerate registered accounts.
  if (msg.includes('invalid login credentials')) {
    return new AppError('Email or password is incorrect.', 'AUTH_INVALID', error);
  }
  if (msg.includes('email not confirmed')) {
    return new AppError('Please confirm your email before signing in.', 'AUTH_UNCONFIRMED', error);
  }
  if (msg.includes('already registered')) {
    return new AppError('An account with that email already exists.', 'AUTH_EXISTS', error);
  }
  if (error.status === 429 || msg.includes('rate limit')) {
    return new AppError('Too many attempts. Please wait a moment and try again.', 'AUTH_RATE_LIMIT', error);
  }
  return new AppError('Could not sign you in. Please try again.', 'AUTH_UNKNOWN', error);
}
```

### Error normalization

```ts
// src/services/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Thrown by bulkCreate when some chunks committed before a later one failed. */
export class PartialImportError extends AppError {
  constructor(
    cause: AppError,
    readonly importedCount: number,
    readonly totalCount: number
  ) {
    super(
      `Imported ${importedCount} of ${totalCount} applications before an error occurred.`,
      'PARTIAL_IMPORT',
      cause
    );
    this.name = 'PartialImportError';
  }
}

const MESSAGES: Record<string, string> = {
  '23503': 'That record no longer exists.',
  '23514': 'Some of those details are not valid — check the job link format.',
  '22P02': 'That filter value is not valid.',   // invalid enum input, e.g. a hand-edited ?status=
  '42501': 'You do not have permission to do that.',
  PGRST116: 'That application could not be found.',
  PGRST301: 'Your session expired. Please sign in again.',
};

export function toAppError(error: { code?: string; message: string }): AppError {
  const code = error.code ?? 'UNKNOWN';
  return new AppError(MESSAGES[code] ?? 'Something went wrong. Please try again.', code, error);
}
```

Raw Postgres error text (`new row violates check constraint "applications_job_link_check"`) is
never shown to a user. The mapping table above turns the codes this app can actually produce into
plain language, and everything else falls back to a generic message with the original preserved in
`cause` for logging.

**Notable code:** `42501` is the RLS-denial code. In normal operation a user should never see it —
if it appears, it means either a policy is wrong or the session expired mid-request. Log
occurrences of it.

## Where server-side logic lives

With no server, logic that must not be trusted to the client has exactly two homes:

### 1. Postgres triggers and functions (preferred)

Already used in [01](./01-database-schema.md) for both cases this app needs:

- **`set_updated_at()`** — timestamps that must be accurate regardless of client clock.
- **`record_status_change()`** — the append-only status timeline, written on every insert/update
  so no client can skip or forge it.

This is the right home for any invariant that must hold *no matter what wrote the row*. It runs
inside the transaction, so it cannot get out of sync with the data it describes.

### 2. Supabase Edge Functions (only when genuinely needed)

Deno functions running on Supabase's infrastructure, used only for work that cannot happen in the
database or the browser — typically because it needs a secret. **v1 needs none of these.** They
are documented here so the boundary is clear for future phases:

- Sending interview-reminder emails (needs an email provider's API key).
- Any future platform integration requiring an OAuth client secret.

If an Edge Function is added, it must still respect user isolation: it receives the caller's JWT,
and should create its Supabase client with that token rather than the `service_role` key unless
it genuinely needs to act across users.

## Realtime

Supabase Realtime streams Postgres changes over a WebSocket. This project uses it for one purpose:
**keeping multiple open clients of the same user in sync** — a laptop and a phone, or two browser
tabs.

```ts
// src/services/realtimeService.ts
import { supabase } from './supabaseClient';
import type { Application } from './applicationsService';

export function subscribeToApplications(
  userId: string,
  onChange: (event: { type: 'INSERT' | 'UPDATE' | 'DELETE' }) => void
) {
  // Channel name must be unique per subscription. A fixed topic re-subscribed
  // during React 18 StrictMode's mount → unmount → remount cycle throws
  // "tried to subscribe multiple times".
  const channel = supabase
    .channel(`applications-changes-${userId}-${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'applications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        // Deliberately does NOT pass the row. In supabase-js v2, payload.new is `{}`
        // (not null) for DELETE and payload.old is `{}` for INSERT, so a
        // `payload.new ?? payload.old` contract silently yields empty objects.
        // The only consumer invalidates the cache anyway — see doc 03.
        onChange({ type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE' });
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
```

Realtime must be enabled per-table, and the replica identity must be widened:

```sql
alter publication supabase_realtime add table public.applications;

-- Required for DELETE events to be usable. With the default REPLICA IDENTITY
-- (primary key only), the `old` record for a DELETE contains ONLY the id —
-- user_id is absent, so the `user_id=eq.` filter below cannot match and the
-- event is dropped entirely. Deletions would silently fail to sync.
alter table public.applications replica identity full;
```

**Three cautions:**

- The `filter` is a performance optimization, not a security boundary. RLS still applies to
  realtime payloads — a user cannot subscribe their way into another user's rows — but including
  the filter avoids the server sending rows the client would then discard.
- **Realtime DELETE payloads are not RLS-filtered the way SELECT is.** With `replica identity
  full`, the full old row is published. This is acceptable here because the `user_id` filter scopes
  the subscription, but it is worth knowing before adding sensitive columns to this table.
- Realtime events and TanStack Query's cache must not fight each other. The integration pattern
  (invalidate the query on a realtime event rather than hand-patching the cache from two
  directions) is specified in [03](./03-frontend-architecture.md).

## Scale limits

`listApplications` sets an explicit `.limit(500)`. PostgREST also enforces a server-side maximum
(1,000 rows by default), so an unbounded query does not error at scale — **it silently truncates**,
which is far worse. The explicit limit makes the ceiling visible in the code.

At 500 applications the client-side grouping and rendering in [03](./03-frontend-architecture.md)
are still comfortable. If a user genuinely approaches this, the fix is keyset pagination on
`(created_at, id)` plus a virtualized list — both are additive and neither is justified in v1.

## Supabase dashboard configuration

Two settings live outside the codebase and are easy to forget until production breaks:

| Setting | Where | Value |
|---|---|---|
| Site URL | Authentication → URL Configuration | The production origin, e.g. `https://tracker.example.com` |
| Redirect URLs | Authentication → URL Configuration | Both `http://localhost:5173/**` and `https://<production-domain>/**` |
| Email confirmation | Authentication → Providers → Email | Off for local development; **on** for production |
| Realtime | Database → Replication | `applications` added to the `supabase_realtime` publication |

Without the Redirect URLs entry, confirmation and password-reset links from the production project
bounce users to `localhost` — the failure looks like "the email link is broken" and has nothing to
do with the code.

## Environment configuration

```bash
# .env.example — commit this file. Never commit .env itself.
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<the anon/public key from Project Settings → API>
```

Add `.env` to `.gitignore` on the first commit, before any real values exist — retroactively
removing a committed key means rotating it, not just deleting the file.

The client throws immediately at import time if either variable is missing (see
`supabaseClient.ts` above) rather than failing later with a confusing network error. This matches
the reference project's `config.py` approach: read configuration once, in one place, and fail
loudly when it is absent.

## Security checklist

Before any deploy, verify each of these:

- [ ] RLS is **enabled** on `applications` and `status_history` (not just policies created — the
      `alter table ... enable row level security` statement must have run).
- [ ] The `update` policy on `applications` has **both** `using` and `with check`.
- [ ] `user_id` has `default auth.uid()` and the client never sends it.
- [ ] `status_history` grants **select only** — no insert/update/delete policy exists.
- [ ] No `service_role` key appears anywhere in the frontend, in `.env.example`, or in git history.
- [ ] `.env` is gitignored.
- [ ] Signing out clears the session (`supabase.auth.signOut()`), and protected routes redirect
      when there is no session — see [03](./03-frontend-architecture.md).
- [ ] Verify isolation manually with two accounts: sign in as user A, note an application id, sign
      in as user B, and attempt to fetch that id directly. The expected result is an empty
      response, not an error — RLS filters rather than rejects, which is correct and should not be
      mistaken for a bug.

---

Next: [03 — Frontend Architecture](./03-frontend-architecture.md).
