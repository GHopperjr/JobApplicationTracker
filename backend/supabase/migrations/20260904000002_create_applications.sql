-- The applications table: the core entity of the tracker. One owner per row,
-- enforced by user_id + RLS below. See docs/01-database-schema.md for the
-- full field-by-field rationale.

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

-- The client never sends user_id on insert; RLS's `with check` below would
-- reject a mismatched value anyway, but this default means it never has to try.
alter table public.applications
  alter column user_id set default auth.uid();

-- Timestamps must never be trusted from the client. status_changed_at tracks
-- pipeline movement only (not edits to notes/salary/etc.), which is what makes
-- stale-application detection meaningful.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();

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

-- Indexes. Every one is user_id-first because RLS scopes every query to one
-- user, making user_id an implicit predicate on all traffic.

-- The single most common query: "all of my ACTIVE applications, newest first."
create index applications_user_active_idx
  on public.applications (user_id, created_at desc)
  where is_archived = false;

-- The archive view.
create index applications_user_archived_idx
  on public.applications (user_id, created_at desc)
  where is_archived = true;

-- Kanban board grouping and status filtering.
create index applications_user_status_idx
  on public.applications (user_id, status);

-- Table view's platform filter.
create index applications_user_platform_idx
  on public.applications (user_id, platform_source);

-- Duplicate detection on add. Not a unique constraint — applying to the same
-- role via two platforms is a real, legitimate case.
create index applications_user_company_title_idx
  on public.applications (user_id, lower(company_name), lower(job_title));

-- Row Level Security: the entire authorization model. There is no server-side
-- code checking permissions, so these policies are not defense-in-depth,
-- they are the defense.
alter table public.applications enable row level security;

create policy "Users can read their own applications"
  on public.applications for select
  using (auth.uid() = user_id);

create policy "Users can insert their own applications"
  on public.applications for insert
  with check (auth.uid() = user_id);

-- `with check` (in addition to `using`) is required here: without it a user
-- could take one of their own rows and reassign its user_id to someone else.
create policy "Users can update their own applications"
  on public.applications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own applications"
  on public.applications for delete
  using (auth.uid() = user_id);
