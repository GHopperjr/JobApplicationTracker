# 00 — Overview

## Problem statement

Job searching today happens across many disconnected platforms — JobStreet, LinkedIn, Indeed,
company career pages, direct email outreach. Each platform has its own "applications" list, but
none of them talk to each other, and none of them track what actually matters to the applicant:
which stage each application is really at, what was discussed in an interview, what salary was
quoted, or when to expect a follow-up. The result is a mental (or, at best, spreadsheet) tracking
burden that gets abandoned within the first few applications.

**The Job Application Tracker exists to be the one place that knows the true status of every
application a person has made, regardless of which platform it came from.**

## Goals

1. **Centralize** every application, from every source platform, into one record structure.
2. **Make status the first-class fact.** An application's stage (Pending, Scheduled for
   Interview, Interviewed, Rejected, Accepted) should be visible and changeable in one click, not
   buried in an edit form.
3. **Support two very different ways of working**: a visual, spatial Kanban board for people who
   think in terms of pipeline stages, and a dense, scannable table for people who want to filter
   and bulk-review. Both must always reflect the same underlying data.
4. **Be genuinely usable on a phone.** Job searching happens in spare moments — on a commute,
   between classes, on a break. A desktop-only tool fails at the exact moments it's needed most.
5. **Be fast to add an application to.** The lowest-friction path — paste a URL, name the
   company, pick a platform, done — should take under 15 seconds. Everything else (notes, salary,
   detailed timeline) is available but never required up front.
6. **Be secure by construction, not by discipline.** A user's applications must be provably
   invisible to every other user, enforced at the database level — not merely "the app happens to
   only query your own rows."

## Non-goals (explicitly out of scope for v1)

- **No automatic scraping or platform integration.** The app does not log into JobStreet/LinkedIn
  on the user's behalf or auto-import applications. Every entry is added manually, or in bulk via
  CSV import ([10](./10-data-import-export.md)). This is a deliberate scope cut: platform scraping
  is fragile, frequently breaks on markup changes, and raises ToS concerns per platform.
- **No product analytics.** No event tracking, no funnels, no behavioral instrumentation. Error
  tracking answers "is it broken," which is the only operational question a single-user personal
  tool actually has — see [09](./09-operations.md).
- **No multi-user collaboration** (shared boards, recruiter accounts, team visibility). This is a
  single-user personal tracking tool. The RLS-per-user model in this doc set assumes exactly one
  owner per row, forever.
- **No resume or cover letter storage/generation.** Out of scope — this app tracks applications,
  it does not manage application *materials*.
- **No email/calendar integration** (e.g., auto-detecting interview invites from Gmail) in v1.
  Interview scheduling is recorded manually in the Detail View. This may be a future phase, not
  part of this build.
- **No notifications of any kind** — no email, no push, no browser notification. Stale-application
  detection ([05](./05-features-and-workflows.md), F10) surfaces follow-up needs passively, with an
  in-app marker, precisely because doing it properly with notifications requires infrastructure this
  scope excludes.
- **No analytics/reporting dashboard** in v1 (e.g., "average time in each stage," "response rate
  by platform"). The data model should not preclude this later, but no such view is built now.
- **No dark mode.** The design system in [04](./04-design-system.md) is light-only, and
  `STATUS_STYLES` in [03](./03-frontend-architecture.md) hardcodes Tailwind utilities rather than
  theme tokens. This is a real cost to reverse — retrofitting dark mode is a full pass over the
  status palette and every neutral — so it is recorded here as a deliberate v1 cut rather than an
  omission. If it is ever wanted, the first step is converting the neutrals and status styles to
  CSS custom properties.
- **No offline-first/PWA behavior.** Queued mutations resume on reconnect (a TanStack Query
  default, see [05](./05-features-and-workflows.md) F8), but there is no service worker, no
  installability, and no local persistence of the cache across reloads.

## Primary persona

**The active job seeker applying to 5–30+ roles concurrently, across 3+ platforms, over a period
of weeks to months.** They are comfortable with web apps, check the tracker from both a laptop
(during focused application sessions) and a phone (to jot a quick update after an interview
call). They care more about *not losing track of where things stand* than about elaborate
reporting.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | React 18 + TypeScript | Type safety across the data layer (application status, platform enums) catches an entire class of bugs — a mistyped status string — at compile time instead of in production. |
| Build tool | Vite | Fast dev server and build; the standard modern choice for a React+TS SPA with no framework-level opinions this project needs. |
| Styling | Tailwind CSS | Utility-first CSS pairs naturally with a minimalist design system (see [04](./04-design-system.md)) — no design-token drift between a separate CSS file and the components that use it. Also matches the reference project's own frontend, which already uses Tailwind. |
| Server state | TanStack Query | Centralizes caching, refetching, and optimistic updates for Supabase calls — critical for drag-and-drop status changes feeling instant while staying consistent with the database. |
| Drag-and-drop | `@dnd-kit/core` | Actively maintained, accessible (keyboard-operable drag-and-drop, important since this is also a touch/mobile app), and has first-class support for both mouse and touch pointers — one library serves both the desktop Kanban and the mobile experience. |
| Routing | React Router | Matches the reference project's routing choice; standard, well-understood. |
| Backend | Supabase (PostgreSQL + Auth + Realtime) | A managed backend gives this project a production-grade, RLS-secured Postgres database, authentication, and realtime subscriptions without operating any server — appropriate for a single-developer, single-user-per-account application. See [02](./02-backend-architecture.md) for exactly how "backend logic" is expressed without a custom server. |
| Testing | Vitest + React Testing Library | Vite-native test runner; RTL matches the reference project's testing philosophy (test behavior via user-facing queries, not implementation details). |
| E2E testing | Playwright | `@dnd-kit` drag behavior cannot be verified in jsdom — there is no layout for collision detection to work against, so the board's central interaction is untestable below this layer. See [08](./08-testing-and-ci.md). |
| CSV parsing | Papaparse | Import/export ([10](./10-data-import-export.md)). Quoted commas, escaped quotes, and Excel's UTF-8 BOM all break naive `split(',')` parsing on the first real file. Lazy-loaded, so it costs nothing to users who never import. |
| Error tracking | Sentry | Production errors are otherwise invisible. Configured with strict privacy rules — no session replay, no query strings — because this app holds a person's private job search. See [09](./09-operations.md). |
| CI | GitHub Actions | Lint, typecheck, test, build on every PR; E2E against a local Supabase instance. |
| Deployment | Vercel for the frontend; two Supabase projects (dev + prod) for the backend | Both offer zero-maintenance, git-push-to-deploy workflows appropriate for this project's scale. Environment strategy in [09](./09-operations.md). |

## High-level architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser (client)                        │
│                                                                    │
│  ┌───────────────┐   ┌──────────────────┐   ┌──────────────────┐ │
│  │  Pages/Routes │──▶│  Custom Hooks     │──▶│ Service Layer     │ │
│  │ (Kanban view, │   │ (useApplications, │   │ (applications     │ │
│  │  Table view)  │   │  useAuth, ...)    │   │  Service, one     │ │
│  └───────────────┘   └──────────────────┘   │  Supabase client) │ │
│         ▲                     ▲              └────────┬─────────┘ │
│         │                     │                        │           │
│  ┌───────────────┐   ┌──────────────────┐              │           │
│  │  UI components│   │  TanStack Query  │              │           │
│  │ (Card, Row,   │   │  cache            │              │           │
│  │  Modal, Drawer)│  └──────────────────┘              │           │
│  └───────────────┘                                     │           │
└──────────────────────────────────────────────────────────┼──────────┘
                                                            │ HTTPS
                                                            ▼
                                   ┌───────────────────────────────────┐
                                   │            Supabase                │
                                   │                                    │
                                   │  ┌──────────────┐  ┌─────────────┐ │
                                   │  │  Auth (JWT)   │  │  PostgREST  │ │
                                   │  └──────────────┘  │  (auto API) │ │
                                   │                     └──────┬──────┘ │
                                   │  ┌─────────────────────────▼──────┐ │
                                   │  │   PostgreSQL                    │ │
                                   │  │   - applications table          │ │
                                   │  │   - Row Level Security policies │ │
                                   │  │   - status_history table        │ │
                                   │  │   - Postgres functions/triggers │ │
                                   │  └──────────────┬───────────────────┘ │
                                   │                  │                     │
                                   │  ┌───────────────▼──────────────┐    │
                                   │  │  Realtime (Postgres CDC)      │    │
                                   │  └───────────────────────────────┘    │
                                   └────────────────────────────────────────┘
```

There is no custom backend server or Lambda-equivalent in this architecture. Where the reference
project has Lambda handlers calling a domain layer, this project has Supabase's auto-generated
PostgREST API secured by RLS policies, with any genuinely server-side logic (see
[02](./02-backend-architecture.md)) implemented as Postgres functions/triggers rather than
application code running on a server the team maintains.

## Reading order for the rest of this set

Proceed to [01 — Database Schema](./01-database-schema.md) next. Everything else in this project
— the backend's authorization model, the frontend's data-fetching hooks, even the shape of the
Application form — is downstream of the schema decisions made there.
