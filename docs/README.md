# Job Application Tracker — Steering Documentation

This is the complete design and build documentation for the Job Application Tracker — a
centralized, multi-platform job application tracking web app built with **React + TypeScript**
on the frontend and **Supabase** (PostgreSQL + Auth + Row Level Security) on the backend.

These documents are the steering set for the entire project: read them in order the first time,
then use them as reference during implementation. Nothing here is code — this is the design that
the code should be built from.

## How to use this set

1. Start with **00 – Overview** for the "what and why" before anything else.
2. **01–03** are the technical core — database, backend, frontend — read in that order, since
   each layer builds on the one before it.
3. **04 – Design System** can be read in parallel with 03; it's referenced by every UI-facing
   decision in the frontend doc.
4. **05 – Features & Workflows** ties the layers together into concrete, end-to-end user flows.
5. **07 – Component & Composition Specifications** is the reference you keep open *while* building:
   the route table, what `ApplicationsPage` composes and passes down, every shared component's
   props, and the details (date parsing, URL setters, debounce placement) that are easy to get
   subtly wrong.
6. **06 – Implementation Roadmap** is where you start once the design is understood — it phases
   the whole build into an order that produces a working app at every checkpoint.
7. **08–10** are read when you reach the phase that needs them: testing/CI setup (08), anything
   about running the app rather than building it (09), and the import/export flows (10).
8. **11 onwards** are post-roadmap features — designed after the fact, built only once 00–10's
   roadmap has fully shipped. Each is self-contained and independently deferrable.

## Document index

| # | File | Covers |
|---|------|--------|
| 00 | [`00-overview.md`](./00-overview.md) | Problem statement, goals, non-goals, personas, tech stack, high-level architecture |
| 01 | [`01-database-schema.md`](./01-database-schema.md) | PostgreSQL schema, enums, indexes, Row Level Security policies, migrations |
| 02 | [`02-backend-architecture.md`](./02-backend-architecture.md) | Supabase as the backend: auth model, the service layer, Postgres functions, realtime |
| 03 | [`03-frontend-architecture.md`](./03-frontend-architecture.md) | React/TypeScript project structure, state management, hooks, routing, testing |
| 04 | [`04-design-system.md`](./04-design-system.md) | Minimalist visual design system: color, type, spacing, components, responsive rules |
| 05 | [`05-features-and-workflows.md`](./05-features-and-workflows.md) | Detailed feature specs: Kanban, Table view, Application form, Detail drawer, filters |
| 06 | [`06-implementation-roadmap.md`](./06-implementation-roadmap.md) | Phased build plan from empty repo to production-ready app |
| 07 | [`07-component-specifications.md`](./07-component-specifications.md) | Route table, page composition contract, AppShell, action menus, toast system, UI primitive APIs, format/URL-state details |
| 08 | [`08-testing-and-ci.md`](./08-testing-and-ci.md) | Test strategy per layer, the non-negotiable tests, Playwright E2E, automated accessibility, GitHub Actions pipeline |
| 09 | [`09-operations.md`](./09-operations.md) | Dev/prod environments, local Supabase loop, migrations workflow, deployment, error tracking, security headers, free-tier limits |
| 10 | [`10-data-import-export.md`](./10-data-import-export.md) | CSV export, and the four-step CSV import flow with column mapping, validation, and partial-failure handling |
| 11 | [`11-navigation-and-distance.md`](./11-navigation-and-distance.md) | Sidebar navigation shell, Settings page, saved locations, and the zero-cost distance/driving-ETA calculator |

## Project at a glance

- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS, TanStack Query, `@dnd-kit` for
  drag-and-drop, React Router, Vitest + React Testing Library.
- **Backend**: Supabase — PostgreSQL with Row Level Security as the sole authorization boundary,
  Supabase Auth for identity, Postgres functions/triggers for server-side logic, Supabase Realtime
  for live cross-tab/device sync. No custom server process is run — Supabase *is* the backend.
- **Core entity**: a single `applications` table, owned per-user via RLS, tracking a job
  application's platform, status, and history from first sighting to outcome.
- **Two views on one dataset**: a Kanban board (drag-and-drop across status columns) and a
  Table view (dense, filterable, sortable) — both reading and writing through the same
  centralized data layer, so they can never drift out of sync with each other.
- **Design direction**: minimalism — restrained color, generous whitespace, content-first
  typography, no decorative chrome. See [04](./04-design-system.md) for the full system.

## Conventions this project follows

This project deliberately mirrors the architectural discipline of the reference codebase it was
modeled after (a serverless Lambda + React application) — not its tech stack, but its *shape*:

- **Thin routes/handlers, real logic underneath.** Just as that project keeps its Lambda handlers
  thin (auth check, parse, delegate) and puts business logic in a separate domain layer, this
  project keeps UI components thin and puts all data access and business rules in a centralized
  service layer and custom hooks — never inline in a component.
- **One client, one place.** That project has a single `api.js` axios client with a request
  interceptor for auth headers, imported everywhere instead of ad hoc `fetch` calls. This project
  has a single Supabase client instance and a single `applicationsService` module — same idea,
  same reason: one place to change auth handling, error shape, or the backend itself.
- **Feature-grouped components, colocated tests.** Components live under
  `components/<feature>/`, each with its own `ComponentName.test.tsx` sitting right next to it —
  matching that project's `components/summary/CsatCards.jsx` + `CsatCards.test.jsx` pattern
  exactly.
- **Authorization pushed to the data layer, not scattered through the UI.** That project resolves
  a caller's role once and scopes every query from there; this project does the same thing more
  directly, since Postgres RLS enforces per-user isolation at the database itself — no query in
  the app can ever accidentally leak another user's rows, even if application code has a bug.

Every technical document in this set calls out where it's following this precedent explicitly.
