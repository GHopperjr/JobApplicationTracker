-- Append-only record of every status transition, powering the Detail View's
-- timeline. Written exclusively by the trigger below — no client ever gets an
-- insert/update/delete policy, which is what makes this genuinely tamper-proof
-- from the application's perspective. See docs/01-database-schema.md.

create table public.status_history (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.applications (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,

  from_status     application_status,
  to_status       application_status not null,
  changed_at      timestamptz not null default now()
);

-- Timeline lookup for one application's Detail View.
create index status_history_application_idx
  on public.status_history (application_id, changed_at desc);

-- Supports the RLS predicate below.
create index status_history_user_idx
  on public.status_history (user_id);

alter table public.status_history enable row level security;

-- Select only. History rows are written exclusively by the trigger function
-- via owner exemption from RLS (not because of `security definer` itself) —
-- see the note in docs/01-database-schema.md before ever adding
-- `force row level security` to this table.
create policy "Users can read their own status history"
  on public.status_history for select
  using (auth.uid() = user_id);

-- History is written by a trigger, not the client, so a status change made
-- from any source (SQL console, a future mobile app, a bulk update) is always
-- captured.
create or replace function public.record_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (TG_OP = 'INSERT') then
    insert into public.status_history (application_id, user_id, from_status, to_status)
    values (new.id, new.user_id, null, new.status);
  elsif (TG_OP = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.status_history (application_id, user_id, from_status, to_status)
    values (new.id, new.user_id, old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger applications_record_status_change
  after insert or update on public.applications
  for each row
  execute function public.record_status_change();
