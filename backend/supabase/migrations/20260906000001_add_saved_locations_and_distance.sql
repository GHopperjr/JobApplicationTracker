-- doc 11 — navigation shell & distance calculator. Saved locations are the
-- points a distance is measured *from*; applications gain a geocoded cache
-- of their existing free-text `location` to measure *to*. See
-- docs/11-navigation-and-distance.md for the full feature rationale.

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

-- Exactly one default per user, enforced by the database rather than by the
-- UI — promoting a new default is a two-statement transaction (clear the
-- old, set the new); if that ever raced itself, this index rejects the
-- write rather than silently leaving two defaults.
create unique index saved_locations_one_default_per_user
  on public.saved_locations (user_id)
  where is_default;

-- A separate, generic trigger function rather than reusing
-- public.set_updated_at() (applications.sql): that function's body reads
-- `new.status`, a column saved_locations does not have, which would raise
-- "record new has no field status" on every update.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger saved_locations_set_updated_at
  before update on public.saved_locations
  for each row
  execute function public.touch_updated_at();

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

-- A derived cache of the existing free-text `location` field, not a
-- replacement for it. Nullable and unindexed: never filtered or sorted on,
-- only read alongside the row that owns them, and absent whenever the
-- address hasn't geocoded (empty, "Remote", unresolvable, etc.).
alter table public.applications
  add column location_latitude  double precision,
  add column location_longitude double precision;
