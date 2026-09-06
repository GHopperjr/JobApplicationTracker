-- doc 12 — interview metrics. A singleton-per-user row: user_id is the
-- primary key itself, not a separate id with a unique constraint, so "two
-- preference rows for one user" is unrepresentable rather than merely
-- disallowed. Named user_preferences rather than metrics_settings on
-- purpose — doc 13's profile fields will extend this same table with a
-- one-line migration instead of introducing a second near-identical
-- singleton-per-user table.

create table public.user_preferences (
  user_id                   uuid primary key references auth.users (id) on delete cascade,
  monthly_application_goal  integer check (monthly_application_goal > 0),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table public.user_preferences
  alter column user_id set default auth.uid();

-- Reuses the generic trigger function from saved_locations' migration
-- (20260906000001) rather than applications' own set_updated_at(), which
-- reads new.status — a column this table doesn't have.
create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row
  execute function public.touch_updated_at();

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

-- No delete policy: clearing a goal sets the column to null, it does not
-- remove the row.
