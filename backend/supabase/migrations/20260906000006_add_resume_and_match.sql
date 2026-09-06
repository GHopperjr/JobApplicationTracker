-- doc 14 — AI resume <-> job match scoring. Extends user_preferences
-- (doc 12) with the one resume a user can have on file, and applications
-- with an optional job description plus the cached match result.
--
-- Every column here is nullable, and the feature is invisible in their
-- absence — the same graceful-absence rule docs 11 and 13 already
-- establish. No resume, no match button anywhere. No job description, no
-- match button on that specific application, even with a resume on file.

alter table public.user_preferences
  add column resume_storage_path text,
  add column resume_filename     text,
  add column resume_text         text,
  add column resume_uploaded_at  timestamptz;

alter table public.applications
  add column job_description     text,
  add column match_percentage    integer check (match_percentage between 0 and 100),
  add column match_explanation   text,
  add column match_calculated_at timestamptz;

-- Storage: one bucket, not public, objects under a {user_id}/ prefix. The
-- policy is the storage equivalent of every RLS predicate elsewhere in this
-- app — a user reaches only their own folder, enforced by the database
-- rather than trusted to application code. storage.objects already has RLS
-- enabled by default on Supabase-managed projects.
insert into storage.buckets (id, name, public) values ('resumes', 'resumes', false);

create policy "Users can manage their own resume"
  on storage.objects for all
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
