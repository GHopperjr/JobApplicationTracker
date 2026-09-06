# 09 — Operations

Everything about running this app rather than building it: environments, the local development
loop, deployment, error tracking, and security headers.

---

## Environments

Two Supabase projects and two deploy targets. This is the smallest split that is actually safe.

| | Development | Production |
|---|---|---|
| Supabase project | `jat-dev` | `jat-prod` |
| Data | Disposable, seeded | Real |
| Email confirmation | Off | **On** |
| Frontend | Vercel preview deploys (per PR) | Vercel production (`main`) |
| Who can write to it | Anyone on the team, freely | Only via a merged, migrated deploy |

**Why two projects rather than one.** With a single project, testing a migration means testing it
against real data, and there is no way to try a destructive change without risking it. The free tier
covers two projects; the cost of not having a second one is measured in lost data.

**A third `staging` project is deliberately not recommended here.** For a single-developer app with
this shape, staging tends to become a place migrations sit untested in a different way. Preview
deploys pointed at `jat-dev` already provide the "see it working before merge" value that staging
usually justifies.

### Local development is a third environment

`supabase start` runs the whole stack in Docker on your machine — Postgres, Auth, PostgREST, Realtime,
Studio. This is where migrations get written and E2E tests run. It is disposable by design: `db reset`
drops everything and replays every migration from scratch.

**Migrations are always written and applied locally first.** Never author schema changes in the
hosted dashboard's SQL editor — a change made there exists in no migration file, and the next
`db reset` silently loses it while the hosted project keeps it. That divergence is very hard to
diagnose later.

---

## Local development loop

### One-time setup

```bash
npm install -g supabase           # or: brew install supabase/tap/supabase
supabase init                     # creates supabase/ with config.toml
supabase link --project-ref <dev-project-ref>
```

Docker Desktop must be running — `supabase start` is a Docker Compose stack underneath.

### Daily loop

```bash
supabase start                    # boots the local stack (~30s cold, seconds warm)
npm run dev                       # Vite against local Supabase
```

`supabase start` prints local credentials on first boot. Put them in `.env.local`, which Vite prefers
over `.env`:

```bash
# .env.local — local Supabase, not the hosted dev project
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<the anon key supabase start prints>
```

Local Studio runs at `http://127.0.0.1:54323` — the same table editor and SQL console as the hosted
dashboard, against your local database.

### Writing a migration

```bash
supabase migration new add_stale_tracking      # creates a timestamped empty file
# ...write the SQL...
supabase db reset                              # drops, replays ALL migrations, runs seed.sql
npm run db:types                               # regenerate TypeScript types from the new schema
```

**`db reset` rather than applying the one file** — replaying from scratch every time is what proves
the migration works on a clean database, which is exactly what will happen in CI and on the hosted
project. A migration that only works against your particular current state is a migration that fails
on deploy.

### Seed data

`supabase/seed.sql` runs automatically at the end of every `db reset`. It needs a user to own the
rows, so it creates one directly:

```sql
-- supabase/seed.sql — LOCAL ONLY. Never runs against a hosted project.
insert into auth.users (id, email, encrypted_password, email_confirmed_at, role, aud)
values (
  '00000000-0000-0000-0000-000000000001',
  'test@example.com',
  crypt('password123', gen_salt('bf')),
  now(), 'authenticated', 'authenticated'
) on conflict (id) do nothing;

-- ...then the applications inserts from doc 01, using that user_id.
```

The fixed UUID matters — E2E tests and seeded rows both reference it, and a random one would make
tests unrepeatable.

### Deploying a migration

```bash
supabase db push                  # applies pending migrations to the LINKED project
```

Check which project is linked (`supabase projects list`) before running this. The command is the same
for dev and prod; only the link differs, which is precisely why it deserves a deliberate check.

---

## Deployment

### Frontend (Vercel)

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm ci` |

**Environment variables**, set per-environment in the Vercel dashboard:

| Variable | Production | Preview |
|---|---|---|
| `VITE_SUPABASE_URL` | `jat-prod` URL | `jat-dev` URL |
| `VITE_SUPABASE_ANON_KEY` | `jat-prod` anon key | `jat-dev` anon key |
| `VITE_SENTRY_DSN` | production DSN | *(unset — see below)* |
| `GEMINI_API_KEY` ([14](./14-ai-match-scoring.md)) | the one Gemini key | same key |

Preview deploys point at `jat-dev` so a PR can be clicked through with disposable data.

**`GEMINI_API_KEY` is this app's first non-`VITE_`-prefixed variable, and the first not tied to a
per-environment Supabase project.** Deliberately no `VITE_` prefix — that prefix is precisely
Vite's signal to inline a variable into the client bundle, the one thing this key must never do
([14](./14-ai-match-scoring.md)). Unlike the Supabase variables above, Production and Preview use
the **same** value: Gemini's free tier has no dev/prod split the way Supabase does, and this app's
realistic volume (doc 14: "at most, a few dozen match requests ever") never approaches a scale
where sharing one key across environments matters.

### SPA routing

Without a rewrite, a hard load of `/applications/abc-123` returns Vercel's 404 — the file does not
exist; the route is client-side.

```json
// vercel.json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Deploy checklist

- [ ] Migrations pushed to `jat-prod` **before** the frontend deploy that depends on them.
- [ ] `database.types.ts` regenerated and committed if the schema changed.
- [ ] Supabase Auth URL configuration updated if the domain changed
      ([02](./02-backend-architecture.md)).
- [ ] Email confirmation **on** for `jat-prod`.
- [ ] The security checklist at the end of [02](./02-backend-architecture.md) re-run against
      production.
- [ ] **Once [14](./14-ai-match-scoring.md) exists:** `GEMINI_API_KEY` set in Vercel (Production
      and Preview) *before* that deploy — a missing key fails every match request, not the build
      itself, so this is easy to miss until someone actually clicks "Calculate Match."
- [ ] **Once [14](./14-ai-match-scoring.md) exists:** confirm `/api/match` actually resolves against
      the real deployment (doc 14's own caution — this is the first non-SPA route this project has
      had, and `vercel.json`'s catch-all rewrite is expected, not confirmed, not to shadow it).

**Order matters.** Frontend first means users hit a version of the app querying columns that do not
exist yet. Migrations are additive here (new nullable columns, new tables), so
migrate-then-deploy is safe; a destructive migration would need the reverse plus a compatibility
window.

---

## Error tracking

### Why

Without it, a production error is invisible. The user sees something broken, and there is no
record — no stack trace, no browser, no sequence of actions. "The board stopped working yesterday"
is not a diagnosable report.

### Sentry

```
npm i @sentry/react
```

```ts
// src/lib/monitoring.ts
import * as Sentry from '@sentry/react';

export function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;                       // no DSN in dev/preview — errors go to the console

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 0,          // session replay is off — see privacy below

    beforeSend(event) {
      // This app's data is a person's job search: which companies they applied to,
      // what salary was discussed, private notes about interviews. None of it
      // belongs in an error report.
      if (event.request?.url) {
        event.request.url = event.request.url.split('?')[0];   // strip filter/search params
      }
      delete event.user?.email;
      return event;
    },
  });
}
```

### Privacy rules, non-negotiable

- **No session replay.** Replay would capture company names, salary figures, and interview notes.
- **Query strings are stripped** — the search term is in `?q=`, and a search term is often a company
  name.
- **No email in user context.** The Supabase user id is sufficient to correlate reports.
- **Never send an `Application` object** in error context. If a mutation fails, report the operation
  and the error code, not the row.

### Error boundary

```tsx
// src/components/layout/ErrorBoundary.tsx
<Sentry.ErrorBoundary
  fallback={({ resetError }) => (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <p className="text-sm text-slate-900">Something went wrong.</p>
      <p className="mt-1 text-xs text-slate-500">
        Your applications are safe — this is a display problem.
      </p>
      <Button variant="primary" className="mt-4" onClick={resetError}>Try again</Button>
    </div>
  )}
>
  <App />
</Sentry.ErrorBoundary>
```

The "your applications are safe" line is deliberate. A crash in a tool holding months of tracked
applications provokes exactly one fear, and the fallback should answer it immediately.

`resetError` re-renders rather than reloading — with TanStack Query's cache still warm, recovery is
usually instant.

### What is deliberately not added

**No product analytics.** No PostHog, no Plausible, no event tracking. This is a single-user personal
tool; there is no funnel to optimize and no cohort to study. Error tracking answers "is it broken,"
which is the only operational question that matters here. Adding behavioral analytics to an app
holding someone's private job search is a poor trade for insight nobody will act on.

---

## Security headers

Supabase and RLS secure the data; these secure the page that reaches it.

```json
// vercel.json — merged with the rewrites above
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        }
      ]
    }
  ]
}
```

### Why each directive

| Directive | Reason |
|---|---|
| `connect-src` includes `wss://*.supabase.co` | **Realtime is a WebSocket.** Omitting the `wss:` scheme silently breaks cross-device sync while leaving everything else working — a genuinely confusing failure. |
| `style-src 'unsafe-inline'` | Required by Tailwind's runtime style injection and by `@dnd-kit`, which sets inline transforms on the dragged element. Not ideal; the alternative is a nonce-based CSP, which Vite's static build cannot produce. |
| `font-src` allows `fonts.gstatic.com` | Inter is loaded from Google Fonts ([04](./04-design-system.md)). |
| `img-src data:` | Skeleton placeholders and any inline SVG data URIs. |
| `frame-ancestors 'none'` + `X-Frame-Options: DENY` | Clickjacking. Both, because older browsers ignore the CSP form. |
| `X-Frame-Options: DENY` rather than `SAMEORIGIN` | Nothing in this app is ever framed. |

**`script-src 'self'` with no `'unsafe-inline'`** — verify this after adding Sentry, which can inject
inline snippets depending on integration method. If the console reports a CSP violation, fix the
integration rather than loosening the policy.

Verify headers post-deploy at [securityheaders.com](https://securityheaders.com), and confirm both
realtime sync and font loading still work — a CSP that breaks the app is worse than none, because it
tends to get removed wholesale rather than corrected.

---

## Operational limits

Supabase free tier, and what actually binds first:

| Limit | Free tier | Realistic usage |
|---|---|---|
| Database size | 500 MB | A few hundred rows of text ≈ well under 1 MB. Never the constraint. |
| Bandwidth | 5 GB/month | Not a constraint at this scale. |
| Monthly active users | 50,000 | Not a constraint. |
| Realtime concurrent connections | 200 | Not a constraint for personal use. |
| **Project pausing** | **After 7 days of inactivity** | **This is the one that bites.** |

**Project pausing is the real operational risk.** A free-tier project with no requests for a week is
paused, and the app returns connection errors until someone restores it from the dashboard. For a job
tracker — used intensely for a few weeks, then not at all after an offer is accepted, then urgently
again months later — this is a likely scenario, not a hypothetical.

Mitigations, in order of preference: upgrade to Pro when the tracker is genuinely relied upon; or
accept it and know that restoring takes about a minute from the dashboard. **Do not** work around it
with a scheduled job that pings the database to fake activity — it burns bandwidth to defeat a
mechanism that exists for a reason, and it will not survive a policy change.

---

## Monitoring checklist

There is no dashboard to build; this is the periodic manual check:

- [ ] Sentry issues triaged — recurring errors, not one-offs.
- [ ] **Any `42501` (RLS denial) in the logs.** In normal operation this should never occur; its
      appearance means either a policy is wrong or sessions are expiring mid-request
      ([02](./02-backend-architecture.md)).
- [ ] Supabase dashboard → Database → row count roughly matching expectation (a sudden jump suggests
      a runaway import).
- [ ] Auth logs for repeated failed sign-ins.
- [ ] Free-tier pause warnings, if applicable.
