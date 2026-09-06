# 11 — Navigation Shell & Distance Calculator

The first of the post-roadmap features. Everything in [06](./06-implementation-roadmap.md) ships
first; this document describes what gets built after Phase 8 closes.

Two things are specified together here because one enables the other: the app grows a **navigation
shell** (a sidebar) because it stops being a single-screen app, and the first thing that second
screen holds is **saved locations**, which is what the **distance calculator** measures from.

---

## Scope

**In scope:**

- A persistent left sidebar as a top-level section switcher.
- A Settings page, reached from that sidebar.
- Saved locations — a small labelled list per user ("Home", "Boarding House", "Apartment").
- Straight-line distance from a saved location to a job application's location, in kilometres.
- Estimated driving time (car only) between the same two points.

**Explicitly not in scope:**

- **Live browser geolocation.** There is no `navigator.geolocation` call anywhere in this feature,
  and therefore no location permission prompt. The user types an address once; that is the only
  location data the app ever holds. This was a deliberate choice over live geolocation — see
  *Why saved locations rather than live geolocation* below.
- **Public transport ETA.** Bus/jeepney travel time is not calculated. See *Why no transit ETA*.
- **Turn-by-turn directions or an embedded map.** No map tiles are rendered anywhere. The feature
  outputs two numbers and nothing else.

**Related future documents**, each to be designed on its own and built in this order:

| # | Feature | Status |
|---|---|---|
| 11 | Navigation shell + distance calculator | This document |
| 12 | Interview metrics | Not yet designed |
| 13 | Profile: fresh-grad / experience categorisation and filtering | Not yet designed, exploratory |
| 14 | AI resume ↔ job posting match scoring | Not yet designed, speculative |

---

## Cost constraint

**This feature must cost nothing to run, permanently.** That is a hard requirement, and it is the
single constraint that decides every third-party choice below.

"Zero cost" here means stricter than "has a free tier": it means **no billing account, no credit
card on file, and no API key to provision or rotate.** A free tier that requires a card is still a
service that can start charging after a policy change or a traffic spike, and it is one more secret
to configure in Vercel and GitHub. Both services chosen below need neither.

| Service | Used for | Cost | Account needed | Key needed |
|---|---|---|---|---|
| Photon (OpenStreetMap, komoot.io) | Address → coordinates | $0 | No | No |
| OSRM (public demo server) | Driving distance + duration | $0 | No | No |

Both are community-run public endpoints with usage policies rather than contracts. That trade is
acceptable here specifically because this app's request volume is tiny and bounded — see
*Request volume* below — and because both failure modes degrade to "no distance shown," never to a
broken app.

---

## Navigation shell

### What changes

The app currently has one screen and a top header. It gains a sidebar because it is about to have
more than one screen.

```
┌────────────────┬──────────────────────────────────────────────┐
│                │  [header: view toggle, Add, account menu]    │
│  Job Tracker   ├──────────────────────────────────────────────┤
│                │                                              │
│  Job Apps      │                                              │
│  Settings      │            (page content)                    │
│                │                                              │
│  ─────────     │                                              │
│  Archive*      │                                              │
│  Metrics*      │                                              │
└────────────────┴──────────────────────────────────────────────┘
                            * added when those features exist
```

| Item | Route | When it appears |
|---|---|---|
| **Job Applications** | `/applications` | Now — the existing page, unchanged |
| **Settings** | `/settings` | With this feature |
| Archive | `/archive` | When Phase 7 lands |
| Interview Metrics | `/metrics` | When doc 12 is built |

**The label is "Job Applications", not "Applications"** — deliberately. "Applications" is ambiguous
in a product that also runs on mobile and the web, where it reads as "apps." The extra word removes
a category of confusion for one word of width.

### What does not change

**The sidebar sits one level above the Board/Table toggle and does not absorb it.** `ViewToggle`
stays exactly where it is, in the header, switching views *within* the Job Applications page. The
sidebar switches *between* pages. Nothing about `KanbanBoard`, `ApplicationsTable`, the drawer, the
filters, or the `?view=` URL parameter changes.

This matters because the sample layout that inspired the sidebar showed both a sidebar entry per
view *and* a header toggle, which is redundant. One of the two has to be the view switcher; it is
the one that already exists and already works.

### Visual treatment

The sidebar adopts the *structure* of the reference layout, not its appearance. Concretely:

- **No icon font.** The reference used Material Symbols. This app has no icon font and should not
  gain one for five nav links — it renders text labels, consistent with every other surface, which
  use plain characters (`⋮`, `⠿`, `✕`) where a glyph is needed at all.
- **Existing tokens only.** Neutral slate palette, Inter, the spacing scale from
  [04](./04-design-system.md). No new colour system.
- Active item: `bg-slate-100 text-slate-900 font-medium`. Inactive: `text-slate-600`, with
  `hover:bg-slate-50`. The active item is also marked `aria-current="page"`.
- Width `w-56`, `border-r border-slate-200`, `bg-white`.

### Responsive behaviour

Below `768px` the sidebar is not persistent — it would eat half a phone screen. It collapses to a
menu button in the header that opens the nav in the existing `Drawer` primitive, which on mobile is
already a **bottom sheet**.

It is deliberately *not* a left-edge slide-out, even though that is the conventional mobile nav
pattern. [04](./04-design-system.md) establishes that every overlay in this app becomes a bottom
sheet on mobile — modal, drawer, filters — and a third overlay direction for one surface would cost
a new `Drawer` variant and break that consistency to save nothing. The nav list is five items; it
does not need a full-height panel.

This is the same breakpoint (`useIsMobile`) every other responsive decision in the app uses.

### Structural placement

`AppShell` currently renders `header` + `main`. It gains a sibling `nav` and a flex wrapper. The
sidebar is part of the shell, not part of any page, so it does not re-render or lose scroll position
on navigation.

```tsx
<div className="flex min-h-screen">
  {!isMobile && <Sidebar />}
  <div className="flex min-h-screen flex-1 flex-col">
    <header>…</header>
    <main><Outlet /></main>
  </div>
</div>
```

`Sidebar` is a new component under `components/layout/`. Nav items come from a single exported
array so that adding Archive or Metrics later is a one-line change in one file, not an edit in
three places.

---

## Data model

### `saved_locations`

A new table. One row per place the user might commute from.

```sql
create table public.saved_locations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  label       text not null check (char_length(trim(label)) between 1 and 60),
  address     text not null check (char_length(trim(address)) between 1 and 300),
  latitude    double precision,
  longitude   double precision,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.saved_locations
  alter column user_id set default auth.uid();

create index saved_locations_user_id_idx on public.saved_locations (user_id, created_at);

-- Exactly one default per user, enforced by the database rather than by the UI.
create unique index saved_locations_one_default_per_user
  on public.saved_locations (user_id)
  where is_default;
```

RLS is identical in shape to `applications` — enabled in the same migration as the table, with all
four policies, and `update` carrying **both** `using` and `with check`
([02](./02-backend-architecture.md)):

```sql
alter table public.saved_locations enable row level security;

create policy "Users can read their own saved locations"
  on public.saved_locations for select
  using (auth.uid() = user_id);

create policy "Users can insert their own saved locations"
  on public.saved_locations for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own saved locations"
  on public.saved_locations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own saved locations"
  on public.saved_locations for delete
  using (auth.uid() = user_id);
```

An `updated_at` before-trigger is attached here too — but **a separate
`touch_updated_at()` function, not the `set_updated_at()` used by `applications`.** That one's body
reads `new.status` to maintain `status_changed_at`; `saved_locations` has no `status` column, so
reusing it raises `record "new" has no field "status"` on every update. (Verified against a local
database during implementation — this correction replaces the original instruction to reuse it.)

**`latitude`/`longitude` are nullable on purpose.** A row exists as soon as the user saves it; the
coordinates arrive from geocoding, which can fail. A location with no coordinates is still a valid,
editable row — it simply cannot participate in a distance calculation.

**The partial unique index is the entire "one default" rule.** No application code checks it, and
no trigger enforces it. Promoting a new default is a two-statement transaction (clear the old, set
the new) which the service layer performs; if it ever raced itself, the index rejects the write
rather than silently leaving two defaults.

### `applications` additions

```sql
alter table public.applications
  add column location_latitude  double precision,
  add column location_longitude double precision;
```

Two nullable columns, geocoded from the existing free-text `location` field. No index — they are
never filtered or sorted on, only read alongside the row that owns them.

**`location` stays free text and stays the source of truth.** The coordinates are a derived cache
of it, nothing more. This preserves the decision recorded in [01](./01-database-schema.md) to keep
location human-typed rather than constrained to a lookup table, and it means a failed or wrong
geocode never damages the data the user actually entered.

Regenerate `database.types.ts` after both migrations and commit it.

---

## Geocoding — Photon

**Corrected after implementation — the original spec named Nominatim here, and it does not work.**
Nominatim's public server sends no `Access-Control-Allow-Origin` header at all (verified directly
against the live endpoint), so a browser `fetch()` to it is blocked by CORS on every call, always.
Because this feature's contract is "never throw, just return no coordinates," that failure was
silent — every address appeared to simply not resolve, with no error anywhere. **Photon**
(`photon.komoot.io`) replaces it: same OSM data, same no-API-key/no-billing profile, and it does
send `Access-Control-Allow-Origin: *`.

### The request

```
GET https://photon.komoot.io/api/
      ?q=<uri-encoded address>
      &limit=1
```

The response is GeoJSON. The first feature's `geometry.coordinates` is taken as `[longitude,
latitude]` — **GeoJSON order, the reverse of a `lat`/`lon` pair** and the same trap OSRM's own
coordinate order is. Anything else in the response is discarded. `limit=1` is deliberate — this
feature does not offer the user a "did you mean?" list of candidate addresses. It either resolves
to one point or it does not resolve.

### Usage policy compliance

Photon's public server is free for reasonable use, with no API key or account, the same spirit as
OSRM's public demo server below:

| Requirement | How it is met |
|---|---|
| Reasonable request volume | Trivially — requests are user-initiated and rare (see *Request volume*) |
| No bulk geocoding | Never more than one address per user action |
| Attribution | "© OpenStreetMap contributors" credited in the Settings page footer, beside the saved-locations list — Photon's underlying data is OSM's, same as Nominatim's would have been |

### Content Security Policy

`vercel.json`'s `connect-src` currently allows only `'self'` and Supabase. Both new hosts must be
added or **every geocoding and routing request will be blocked in production while working
perfectly in local development**, which is exactly the failure mode already hit once with the
Supabase URL during the first production deploy.

```
connect-src 'self'
            https://*.supabase.co
            wss://*.supabase.co
            https://photon.komoot.io
            https://router.project-osrm.org;
```

### When geocoding runs

**At write time, never at view time.**

| Trigger | Geocodes |
|---|---|
| Saved location created | Its `address` |
| Saved location's `address` edited | Its `address` |
| Application created with a `location` | That `location` |
| Application's `location` edited | The new `location` |

Everything else — opening the drawer, rendering a card, switching which saved location to measure
from — reads coordinates that already exist and calls no external API at all.

**Geocoding never blocks the write it accompanies.** The application or saved location is inserted
first; the geocode is attempted after, and its result is patched onto the row if it succeeds. A
Photon outage, a rate-limit rejection, or an unresolvable address leaves `latitude`/`longitude`
null and produces no error toast. The user's data is saved either way. This is a feature that
enhances a row, not a validation step that can reject one.

### What does not geocode

Roughly a third of realistic `location` values will never resolve to a point, and that is expected:

- Empty locations.
- "Remote", "Remote (PH)", "Work from home", "Anywhere".
- Vague locations ("Metro Manila" resolves, but to a centroid that is not meaningfully "where the
  job is").

The first two produce null coordinates and no distance UI. The third resolves and shows a distance
that is only as precise as what the user typed — which is acceptable, because the user typed it and
can see what they typed.

**Correction, verified live against Photon:** the second bullet's premise was wrong.
`geocodeAddress("Remote (PH)")` does not fail to resolve on its own — Photon's fuzzy matching
returned a real coordinate hundreds of km away (Mindanao), not a clean "no match." A mocked test
suite alone never would have caught this, since a mock only proves the code handles the response
*you wrote*. `geocodeAddress` now checks a short denylist of known non-address placeholders
("remote", "remote (ph)", "work from home", "wfh", "anywhere", "n/a", "tbd", "tba", …) and returns
`null` immediately, before any request — verified against the live endpoint after the fix. This
check lives only in `geocodeAddress` (the silent write-time fallback), not in `searchPlaces` (the
live picker): a user looking at real search results before picking one is a fundamentally safer
situation than a value being silently geocoded with no one watching.

### Search-as-you-type

**Added after the original spec, in response to a real precision problem it caused.** A single
free-typed field cannot tell the user *how* to phrase an address, and a bad phrasing failed
silently: a real address (`"5th Floor, PNB Building, 6754 Ayala Ave, Legazpi Village, Makati City,
1229 Metro Manila"`) returned zero results, while the same place phrased naturally
(`"PNB Building Ayala Avenue Makati"`) resolved precisely. The data was never the problem — the
query shape was.

Both the saved-location address field and an application's location field are backed by
`components/ui/AddressAutocomplete`: typing debounces (300ms) into a live Photon query
(`searchPlaces`, `limit=5`), shown as a dropdown under the field. Picking a result fills the field
with a clean formatted address and hands the caller the resolved coordinates *and* the place's own
name when Photon's data has one (`"PNB"`, not just an address) — this is also how a company/building
name can be captured directly: searching `"PNB Makati"` by name alone returns real, precisely
located branches, no separate "search by name" feature needed.

**Nothing is forced.** The field stays a plain free-text input underneath — a user can type an
address and never open the dropdown, or edit after picking a suggestion, and the value still
submits. Any edit after a pick clears the resolved coordinates (tracked as component state, not
persisted), falling back to the existing write-time `geocodeAddress` for whatever text is finally
submitted. This is why the two paths never conflict: a pick is a fast-path precision improvement,
never the only way coordinates get set.

**Why not a map picker instead.** Considered and deliberately not built: technically zero-cost
(Leaflet + OSM's own raster tiles, no key), but it's a new ~40KB dependency and the first map surface
in an otherwise map-free app, for a problem that turned out to be about query phrasing, not
precision — live suggestions already show a user when their phrasing is too specific and let them
correct it, without a map. The "no map tiles anywhere" boundary from Scope, above, still holds.

**Saved locations vs. applications differ in one way:** a saved location's `label` is the user's own
nickname for the place, so picking a suggestion offers its name as the label *only when the label
field is still empty* — never overwriting something the user already typed. An application's
`location` field has no equivalent "name" slot to offer into; `company_name` is a separate,
independently-typed field and is never auto-filled from a location pick, since the entity at an
address (a building's ground-floor bank, say) is very often not the employer renting space inside it.

---

## Distance and ETA

### Straight-line distance — no API

Once both points have coordinates, the kilometre figure is **pure client-side arithmetic**. There is
no service call and nothing to rate-limit:

```ts
// lib/distance.ts
const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}
```

Displayed as **kilometres**, one decimal below 10 km and whole numbers above (`4.2 km`, `18 km`).
Metric only — the app's entire context is Philippine, down to the peso salary examples in
[01](./01-database-schema.md).

**This is the number on the card badge**, and it is why the badge costs nothing: by the time a card
renders, both coordinates are already in the row, and the calculation is a few multiplications.

### Driving ETA — OSRM

```
GET https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}
      ?overview=false
```

`routes[0].duration` is seconds, `routes[0].distance` is metres. Only the duration is used; the
kilometre figure shown stays the straight-line one, so the badge and the drawer never disagree with
each other.

**This is a free-flow estimate, not a live-traffic-aware one.** OSRM routes over the real road
network (real streets, one-way restrictions, actual connectivity) — verified live: a real 5 km
Metro Manila route returned "~10 min by car" — but it has no live congestion feed, so it reflects
road-network travel time under good conditions, not "right now" Metro Manila traffic. No free,
zero-cost routing service provides live-traffic ETAs; this is an inherent property of the choice,
not a bug.

**Coordinates are `longitude,latitude` — the reverse of every other API in this feature, and the
reverse of how they are stored.** This ordering trap is the most common OSRM integration bug. The
service layer takes typed `Coordinates` objects and does the flip in exactly one place, so no call
site can get it wrong.

**ETA is computed live, on demand, only when the drawer is open.** It is not stored and not cached:

- It depends on a *pair* (which saved location × which application), so caching it means caching
  N×M values and invalidating them whenever either side moves.
- The drawer is opened rarely and deliberately — this is not a per-card cost.
- Travel time is the one number here with a legitimate reason to be recomputed rather than
  remembered.

If the routing call fails or is slow, the drawer still shows the kilometre distance; only the "~N
min by car" clause is omitted. The two numbers fail independently.

### Why no transit ETA

Bus and jeepney ETA was requested and deliberately dropped, for two independent reasons — either
one alone would be sufficient:

1. **No free routing engine supports transit at all.** OSRM and OpenRouteService route cars,
   bicycles, and pedestrians. Transit routing requires the engine to hold the region's timetables as
   GTFS data, which neither does. The only mainstream option that does is Google's Directions API,
   which requires a billing account — failing the cost constraint outright.
2. **The underlying data largely does not exist for Philippine routes.** Much of the country's
   public transport is informal paratransit without published GTFS feeds. Paying for Google's API
   would, for many of the exact routes this app's user cares about, return nothing or something
   wrong.

A wrong ETA is worse than no ETA — it is a number a person might plan a commute around. Car-only is
honest about what it actually knows.

---

## Request volume

The reason two community-run endpoints are an acceptable dependency:

| Event | Photon calls | OSRM calls | Frequency |
|---|---|---|---|
| Add/edit a saved location | 1 | 0 | A handful of times, ever |
| Add an application | 1 | 0 | A few per week during an active search |
| Edit an application's location | 1 | 0 | Rare |
| Open the detail drawer | 0 | 1 | Several per day at most |
| Render the board or table | **0** | **0** | Constantly |

The last row is the important one. The common case — looking at the board, scrolling, filtering,
switching views — makes **no external requests at all**, because every distance on screen is
arithmetic over columns already fetched with the row.

---

## User interface

### Settings → Saved Locations

The Settings page's first (and initially only) section. Doc 13's profile fields join it later.

- A list of saved locations, each showing label, address, and a "Default" marker on one.
- Add / Edit / Delete per row, using the existing `Modal` and `ConfirmDialog` primitives.
- The add/edit form is two fields — label and address — validated with zod like every other form
  ([05](./05-features-and-workflows.md)), and submitted through `react-hook-form`.
- A location whose address failed to geocode shows a quiet inline note: *"Distance unavailable for
  this address."* It is not an error state and does not block anything; it just explains why that
  location will not produce distances.
- "© OpenStreetMap contributors" sits below the list.

### Application Detail Drawer

A new row in the existing detail list, between Location and Work setup:

```
Distance    12.4 km from Home · ~22 min by car        [Home ▾]
```

The selector only renders when the user has more than one saved location; with exactly one, the
label is stated inline and there is nothing to choose. The selection is component state — it is not
persisted and resets to the default location each time the drawer opens.

### Card and row badge

A compact `12.4 km` badge, in the existing muted meta row alongside platform and date — **kilometres
only, no ETA**. The card's meta line is already carrying three values; a travel-time clause there
would crowd it, and the ETA is exactly the sort of detail the drawer exists for.

`MobileApplicationRow` and `TableRow` get the same treatment in their meta lines.

### When the feature is invisible

The distance UI — badge and drawer row alike — renders nothing at all when:

- the user has no saved locations, or
- the selected saved location has no coordinates, or
- the application's location has no coordinates.

**No placeholders, no "unknown", no empty-state prompts inside the cards.** A user who has not set
up a saved location sees precisely the app they see today. This is the difference between an
optional feature and a feature that nags.

---

## Code structure

Following the layering already established in [03](./03-frontend-architecture.md) — services own
I/O, hooks own cache and state, components own rendering and call neither directly:

| File | Responsibility |
|---|---|
| `services/savedLocationsService.ts` | CRUD for `saved_locations`; the two-statement default promotion; accepts pre-resolved coordinates from the picker to skip a redundant geocode |
| `services/geocodingService.ts` | `searchPlaces` (multi-result, backs the picker) and `geocodeAddress` (single-result write-time fallback, built on top of it). Neither throws |
| `services/routingService.ts` | The single OSRM call, including the lng/lat flip. Returns seconds \| null |
| `lib/distance.ts` | `haversineKm`, `formatKm`, `formatDuration`. Pure functions, no I/O |
| `hooks/useSavedLocations.ts` | Query + mutations for the list |
| `hooks/useDefaultLocation.ts` | The selected/default location for distance display |
| `hooks/useDrivingEta.ts` | The on-demand routing query, drawer only, `enabled` on both coordinate pairs existing |
| `components/layout/Sidebar.tsx` | Nav shell |
| `components/ui/AddressAutocomplete.tsx` | The shared search-as-you-type field, used by both the saved-location form and the application form's location field |
| `components/settings/SavedLocationList.tsx` etc. | Settings UI |
| `components/application/DistanceBadge.tsx` | The shared km badge used by card, row, and mobile row |

**`geocodingService` and `routingService` return `null` rather than throwing.** They are the only
two modules in the app that talk to a service which is allowed to be unavailable without it being an
error the user should see. Every consumer treats `null` as "no distance," which is already a state
the UI must handle for un-geocodable addresses — so the failure path and the ordinary path are the
same path, and there is no separate error branch to get wrong.

---

## Testing

Extending [08](./08-testing-and-ci.md)'s layering:

**Unit — the bulk of the value here.**

- `haversineKm` against known city-pair distances, tolerance ±1%.
- `haversineKm` for identical points returns 0, and for antipodal points returns ~20,015 km.
- `formatKm` boundary: `9.94 → "9.9 km"`, `10.4 → "10 km"`.
- The lng/lat flip in `routingService` — assert the URL string, since this is the trap.

**Service (mocked client/fetch).**

- Geocoding a resolvable address returns coordinates; a `[]` response returns `null`.
- A non-200 or a network rejection returns `null` rather than throwing.
- Promoting a default clears the previous one.

**Component.**

- The badge renders nothing when either coordinate is missing.
- The drawer omits the ETA clause when routing returns `null` but still shows kilometres.
- The saved-location form surfaces validation errors and blocks submit, like every other form.
- `AddressAutocomplete`: no search below the minimum query length; no search fires merely from a
  pre-filled value on mount; picking a suggestion fills the field and reports its coordinates;
  editing after a pick clears the resolved coordinates; the picked value doesn't trigger a second,
  redundant search; arrow keys + Enter select the highlighted suggestion.
- Both forms: submitting with a still-matching pick includes coordinates directly; submitting a
  free-typed (never picked, or edited-after-picked) address omits them, leaving the write-time
  fallback to handle it.

**Non-negotiable, in the sense [08](./08-testing-and-ci.md) uses the term:**

> **A failed geocode never blocks the write.** Mock Photon to reject, create an application with
> a location, and assert the application row still exists with null coordinates. Without this, an
> outage of a free third-party service becomes an outage of the app's core function.

**E2E** gains no new spec. The feature depends on two external services that a CI run must not
call — mocking them at the Playwright layer would test the mocks. The unit and service layers cover
this adequately.

---

## Traps

- **CSP blocks both hosts by default.** Add them to `connect-src` in `vercel.json` in the same
  change that adds the first call, or production silently breaks while local development works.
- **A geocoder without CORS support cannot be called from a browser at all, and the failure is
  silent.** This is what happened with the originally-specified Nominatim: no
  `Access-Control-Allow-Origin` header, so every call failed, and because this feature's contract is
  "never throw," it looked exactly like every address just failing to resolve. Before adopting any
  geocoder here, confirm `Access-Control-Allow-Origin` is actually present on a real response —
  a working `curl` request proves nothing about browser usability.
- **OSRM takes `lng,lat`; Photon's GeoJSON response is also `[lng, lat]`; everything else here
  (storage, saved locations, application coordinates) uses `lat, lng`.** Flip in exactly one place
  per API, never inline at a call site.
- **Coordinates are nullable and frequently null.** Every read path needs the null branch — this is
  the normal case for remote roles, not an edge case.
- **Do not cache the ETA.** It is a per-pair value; caching it introduces an invalidation problem
  for a number that costs nothing to recompute.
- **Do not add a second default location by hand.** The partial unique index will reject it; promote
  by clearing then setting.
- **`is_default` is not "the location the drawer is showing."** The drawer's selection is transient
  component state; the default is only its initial value.

---

Next: doc 12, interview metrics — the second post-roadmap feature, not yet designed.
