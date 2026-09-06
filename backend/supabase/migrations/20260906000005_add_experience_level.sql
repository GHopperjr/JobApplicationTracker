-- doc 13 — profile & experience-level filtering. One new enum, two new
-- nullable columns, no new tables. Extends doc 12's user_preferences
-- (anticipated when that table was named generically rather than
-- metrics-specific) with the one fact the career-stage calculation needs.

create type public.experience_level as enum ('fresh_grad', 'experienced');

-- The user's own profile: a graduation date, nothing else. The derived
-- stage (fresh_grad / experienced) is computed at read time from this date
-- and is never itself stored — see lib/experienceLevel.ts.
alter table public.user_preferences
  add column graduation_date date;

-- Which career stage a given application was aimed at. Nullable, meaning
-- "not specified" — every existing row becomes this the moment the column
-- exists, with no backfill and no migration-time data entry.
alter table public.applications
  add column target_experience_level public.experience_level;

-- RLS needs no changes for either column: both sit on rows already
-- protected by their table's existing policies.
