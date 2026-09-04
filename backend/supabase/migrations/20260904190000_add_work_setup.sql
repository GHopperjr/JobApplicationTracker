-- Adds a work-setup classification (Remote / Hybrid / On-site) to
-- applications. A small, fixed set of known values — the same reasoning
-- docs/01-database-schema.md gives for platform_source being an enum
-- rather than free text applies here too.
--
-- Nullable: not one of the four required fields (company_name, job_title,
-- platform_source, status) from docs/01, so it stays optional like
-- location and salary_range. NULL means "not specified", which is why
-- there is no 'other' escape-hatch value — unlike platform_source's open
-- set of possible job boards, every real arrangement is one of these three.
create type work_setup as enum (
  'remote',
  'hybrid',
  'onsite'
);

alter table public.applications
  add column work_setup work_setup;

-- No new RLS policy needed: the existing per-user policies on
-- public.applications already cover every column, including this one.
