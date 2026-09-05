# 13 — Profile & Experience-Level Filtering

The third post-roadmap feature, after [11](./11-navigation-and-distance.md) and
[12](./12-interview-metrics.md). It lets a job seeker record where they are in their career and
filter their tracked applications to the ones aimed at people like them.

**Build order matters here:** this document extends the `user_preferences` table that
[12](./12-interview-metrics.md) creates. Doc 12 ships first, or this feature's migration has nothing
to alter.

---

## Status: foundational, not provisional

This feature was raised as exploratory — "not an official part yet." That framing is about
*confidence in its priority*, not doubt about its design: everything specified here is complete,
buildable, and self-contained.

What that means concretely: **this is the most deferrable of the post-roadmap features.** Nothing in
11, 12, or 14 depends on it, and dropping it costs the app nothing that another feature was counting
on. If time runs short, this is what gets cut — not because it is half-designed, but because it is
the least load-bearing.

---

## Scope

**In scope:**

- A graduation date on the user's profile, and a career stage derived from it.
- A per-application record of who a given job was aimed at.
- A filter combining the two, so the list defaults to showing relevant applications.

**Explicitly not in scope:**

- **Any personal data beyond a graduation date.** Not age, not birthday, not degree, not
  institution. See *Why only a graduation date*.
- **Inferring a job's target audience automatically.** The app has no access to the original posting
  text — the user records it themselves, like every other field on an application. Automatic
  inference from a posting URL would be doc 14's territory, if that ever gets built.
- **More than two career stages.** Fresh graduate and experienced. A third bucket ("more than a year
  graduated") was considered and dropped as indistinguishable in practice from "experienced."

---

## Why only a graduation date

The obvious way to build a profile is to collect the usual personal fields — age, birthday, degree,
school. This design deliberately collects one date and nothing else.

**Every field here has to earn its place by driving a feature.** A birthday would sit in the
database unused: nothing in a job tracker gates on age, there are no birthday reminders, and
[09](./09-operations.md) already rules out the cohort benchmarking that demographic data would
otherwise serve. Storing it would make this the one place in the app that collects personal
information without a feature depending on it — out of step with a codebase that strips salary
figures and company names out of error reports, keeps sign-in errors deliberately vague to avoid
leaking account existence, and runs no analytics at all.

A graduation date is different: it is the *only* input the career-stage calculation needs, and that
calculation is the entire feature.

### Why a date rather than a self-declared category

The first design here was a two-option toggle — the user picks "Fresh Graduate" or "Experienced" and
that setting sits there. It was replaced because **"fresh graduate" is inherently time-bound and a
stored category is not.** Someone who picks Fresh Graduate is, at some point, silently wrong, and
the app has no way to know — it just keeps filtering their list against a status they outgrew months
ago and forgot to change.

A graduation date has no such failure mode. It is a fact that does not change, the derived stage
follows from it automatically, and there is no "did I remember to update this" state to get wrong.

---

## Data model

One new enum, two new nullable columns, no new tables.

```sql
create type public.experience_level as enum ('fresh_grad', 'experienced');
```

### On `user_preferences` (extending doc 12's table)

```sql
alter table public.user_preferences
  add column graduation_date date;
```

**One column, and it is the whole profile.** This is the extension
[12](./12-interview-metrics.md) anticipated when it named that table `user_preferences` rather than
something metrics-specific — the payoff is a one-line migration instead of a second
one-row-per-user table.

RLS needs no changes: the policies doc 12 created cover the row, and a new column on an
already-protected row is protected by construction.

### On `applications`

```sql
alter table public.applications
  add column target_experience_level public.experience_level;
```

Nullable, meaning **"not specified"** — which is what every application that already exists becomes
the moment this ships. There is no backfill and no migration-time data entry; a null here is a
first-class, permanently-supported state, not a gap waiting to be filled.

### The enum is used in exactly one column

`experience_level` types `applications.target_experience_level` and nothing else. In particular,
**there is deliberately no `user_preferences.experience_level` column** — the user's own stage is
computed, never stored. The enum still exists as a shared type because the computation *returns* it,
so the TypeScript union and the database column stay defined in one place.

If a future change adds a stored stage to `user_preferences`, that is a decision to re-open, not an
oversight to correct.

---

## Deriving the career stage

```ts
// lib/experienceLevel.ts
export const FRESH_GRAD_WINDOW_MONTHS = 12;

export function computeExperienceLevel(graduationDate: string | null): ExperienceLevel | null {
  if (!graduationDate) return null;
  return monthsSince(graduationDate) <= FRESH_GRAD_WINDOW_MONTHS ? 'fresh_grad' : 'experienced';
}
```

| Input | Result | Reasoning |
|---|---|---|
| No date set | `null` | No profile, no derived stage, no default filter |
| Date in the future | `fresh_grad` | Not yet graduated but already job hunting — the same postings apply |
| Within 12 months | `fresh_grad` | |
| More than 12 months ago | `experienced` | |

**Twelve months is a named constant, not a magic number**, and it is a judgement call: it matches the
window most "fresh graduate" and "0–1 years experience" postings describe. Changing it is a one-line
edit with no data migration, because nothing derived from it is stored.

### There is no scheduled job, and none is needed

This app has no server process and no cron ([02](./02-backend-architecture.md)), so "the stage
updates automatically over time" cannot mean a nightly task flipping a column.

It does not need to. **The stage is computed at read time, every time, from the stored date.**
Nothing derived is ever persisted, so nothing can go stale — a user who crosses the twelve-month
mark overnight simply gets a different answer the next time the function runs, with no write having
occurred anywhere.

### Date-only parsing

`graduation_date` is a Postgres `date`, which means it arrives as `"2025-03-15"` and hits **the same
UTC-midnight trap already documented for `applied_date`** ([07](./07-component-specifications.md)):
`new Date("2025-03-15")` parses as UTC midnight and reads as the previous day anywhere west of UTC.

Use the existing `parseDateOnly` helper in `lib/format.ts`. Do not introduce a second date-parsing
path.

### Month arithmetic

`monthsSince` compares **calendar months**, not elapsed days divided by an average month length.
Day-based division drifts — 365/30.44 is 11.99 months, so a graduation exactly one year ago would
land on the wrong side of a 12-month boundary. Compare year and month components, then the day of
month as a tiebreaker.

---

## Filtering

### The three filter values

The new filter dimension offers exactly the three states an application can be in:

| Chip | Matches | URL value |
|---|---|---|
| Fresh-grad friendly | `target_experience_level = 'fresh_grad'` | `fresh_grad` |
| Experienced required | `target_experience_level = 'experienced'` | `experienced` |
| Not specified | `target_experience_level is null` | `unspecified` |

**`unspecified` is a filter token, not an enum value.** The database column has two enum values plus
null; the filter has three selectable states. `unspecified` exists only in the URL and in the chip
list, and the service layer translates it to an `is null` predicate rather than passing it to
`.in('target_experience_level', …)` — where it would be rejected as an invalid enum input (`22P02`),
exactly the failure `useApplicationFilters` already guards against for hand-edited `?status=`
values.

### The default, and the one URL subtlety

When a user has a graduation date set, the filter starts pre-selected to their stage **plus "Not
specified"** — a fresh graduate sees fresh-grad-friendly and unlabelled applications, and
experienced-only postings drop out of view.

"Not specified" is included by default deliberately: **hiding an application because a field is
blank would hide data the user definitely wants to see**, and most applications will be unlabelled
for as long as the user hasn't gone back to tag old ones.

The subtlety is in how that default coexists with URL state. Every other filter in the app treats
*absent parameter* and *zero chips selected* as the same thing — "show all"
([03](./03-frontend-architecture.md)). This filter cannot, because the default has to apply when the
parameter is absent:

| URL | Meaning |
|---|---|
| No `audience` parameter | Apply the profile-derived default (or show all, if no graduation date is set) |
| `audience=all` | **Explicitly** show everything — the user cleared the filter deliberately |
| `audience=fresh_grad&audience=unspecified` | Exactly those, as selected |

**The `all` sentinel exists to prevent springback.** Without it, a user who deselects every chip
produces a URL with no parameter, which is indistinguishable from a fresh page load — so the default
would immediately re-apply and the filter would appear to refuse being cleared. The sentinel makes
"I cleared this on purpose" representable.

This is the only filter in the app with a special URL value, and the reason is confined to this
paragraph: it is the only filter with a non-empty default.

### Everything after the first touch is ordinary

Once the user interacts with the chips, this filter behaves exactly like Status and Platform —
values in the URL, shareable, surviving refresh, `replace: true` on write. The profile only decides
what the *first* render looks like.

---

## User interface

### Settings → Profile

A new section on the Settings page introduced by [11](./11-navigation-and-distance.md), sitting
alongside Saved Locations and doc 12's monthly goal:

```
Profile

Graduation date   [ 2025-03-15 ]
                  Currently: Fresh Graduate — 6 months since graduating

                  Used to filter applications to roles aimed at your
                  career stage. Leave blank to skip this.
```

- One date input. Optional, clearable.
- The derived stage displayed **read-only** beneath it — it is a consequence of the date, and
  offering a way to edit it directly would recreate the stale-category problem this design exists to
  avoid.
- One line explaining what it does, because a date field with no stated purpose is a field people
  leave blank.

### Application form

One new optional `Select` — "Who is this job for?" — with a blank default labelled *Not specified*,
grouped with the other optional fields (location, work setup, salary, applied date, notes).

This follows the exact pattern `work_setup` already establishes: an optional enum `Select` whose
blank option maps to `null` through the same `normalizeOptionalFields` coercion in the service layer
([02](./02-backend-architecture.md)), so `''` never reaches Postgres.

**It is never required.** [06](./06-implementation-roadmap.md)'s definition of done includes "add an
application in under 15 seconds, minimum fields only," and a mandatory field on the add form
directly contradicts that. Tagging is something a user does when they care, not a toll on every
entry.

### Filter bar

A third `MultiSelectFilter` beside Status and Platform, using the same chip rendering, the same
`aria-label`-ed `role="group"`, and the same URL wiring. No new UI idiom.

---

## Code structure

Following [03](./03-frontend-architecture.md)'s layering:

| File | Responsibility |
|---|---|
| `lib/experienceLevel.ts` | `computeExperienceLevel`, `monthsSince`, `FRESH_GRAD_WINDOW_MONTHS`. Pure, no I/O, no React |
| `constants/experienceLevel.ts` | Enum values, labels, and filter-chip ordering — mirroring `constants/status.ts` and `constants/platforms.ts` exactly |
| `hooks/useUserPreferences.ts` | Extended (doc 12 created it) to read/write `graduation_date` |
| `hooks/useApplicationFilters.ts` | Extended with the `audience` parameter, including the `all` sentinel |
| `services/applicationsService.ts` | Extended: `target_experience_level` joins `OPTIONAL_FIELDS`, and the filter joins the query builder |
| `components/filters/AudienceFilter.tsx` | Thin wrapper over `MultiSelectFilter`, mirroring `StatusFilter`/`PlatformFilter` |
| `components/settings/ProfileSection.tsx` | The date input and derived-stage display |

**Every one of these is an extension of something that already exists**, except the two new leaf
components. That is a deliberate consequence of the design: a new filter dimension, a new optional
field, and a new settings section are all shapes this codebase already has, and the feature is
mostly a matter of adding one more instance of each.

---

## Testing

Extending [08](./08-testing-and-ci.md).

**Unit — where the real risk is:**

- `computeExperienceLevel` boundaries: exactly 12 months → `fresh_grad`; 12 months and one day →
  `experienced`; a future date → `fresh_grad`; `null` → `null`.
- `monthsSince` uses calendar months: a date exactly one year ago returns 12, not 11.99.
- **Timezone safety**, using the same matrix `lib/format.test.ts` already runs — a graduation date of
  `2025-03-15` computes identically under `Asia/Manila` and `America/Los_Angeles`. This is the
  documented `parseDateOnly` trap, and this function is the second place in the app that can fall
  into it.

**Hook / integration:**

- With a graduation date and no `audience` parameter, the derived default applies.
- With `audience=all`, everything shows — and **it stays showing**; the default does not re-apply.
  This is the springback regression test.
- With no graduation date, the filter behaves exactly like Status: absent parameter shows everything.
- A hand-edited `?audience=bogus` value is dropped, not passed to the query — the same validated-not-
  cast treatment `?status=` already gets ([08](./08-testing-and-ci.md)'s non-negotiable #6).

**Component:**

- Saving an application without touching the new field stores `null`, not `''`.
- The Settings section renders the derived stage read-only, with no control to edit it directly.

**Non-negotiable, in [08](./08-testing-and-ci.md)'s sense:**

> **Clearing the audience filter must stay cleared.** Set a graduation date, clear the filter, assert
> the applications list still shows every row and the URL still reads `audience=all` after a
> re-render. Without the sentinel this fails in a particularly bad way — the filter snaps back with
> no error and no explanation, and the user concludes the app is ignoring them.

---

## Traps

- **Do not store the derived stage.** It is a function of the date and the current time; persisting
  it recreates the exact staleness problem that made the original toggle design unworkable.
- **Absent parameter ≠ empty selection for this filter only.** The `all` sentinel is load-bearing;
  removing it as "redundant" reintroduces springback.
- **`graduation_date` is a date-only column.** Parse with `parseDateOnly`, never
  `new Date(iso)` — the second instance of the trap [07](./07-component-specifications.md) documents.
- **Compare calendar months, not elapsed days.** Day-based division puts a one-year-old graduation on
  the wrong side of a twelve-month boundary.
- **Never make the application-form field required**, regardless of how much more useful the filter
  would be with complete data. The fast-add guarantee outranks it.
- **`null` on `target_experience_level` is "not specified" and is matched by a chip** — it is a
  filterable value, not an absence to be excluded.
- **Selecting "Not specified" alongside real values needs one `.or()`, not two chained filters.**
  `.in(…)` and `.is(…, null)` chained together AND — producing zero rows every time. The query is a
  single `.or('target_experience_level.in.(fresh_grad),target_experience_level.is.null')`, and
  `.or()` takes a **raw** PostgREST string that supabase-js does not escape — the same hazard
  `escapeOrFilterValue` already exists for in `listApplications`'s search branch
  ([02](./02-backend-architecture.md)). Enum values here are drawn from a fixed constant list rather
  than user input, so they are safe by construction, but the string is still assembled by hand and
  should not interpolate anything that is not from that list.
- **This document's migration depends on doc 12's table.** Shipping 13 before 12 fails at
  `alter table public.user_preferences`.

---

Next: doc 14, AI match scoring between a stored resume and a job posting — the most speculative of
the four, and the only one with an unresolved feasibility question at its centre.
