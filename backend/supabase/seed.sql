-- supabase/seed.sql — LOCAL ONLY. Never runs against a hosted project.
-- Runs automatically at the end of every `supabase db reset`.
-- The fixed UUID matters: E2E tests and seeded rows both reference it, and a
-- random one would make tests unrepeatable (docs/09-operations.md).
insert into auth.users (id, email, encrypted_password, email_confirmed_at, role, aud)
values (
  '00000000-0000-0000-0000-000000000001',
  'test@example.com',
  crypt('password123', gen_salt('bf')),
  now(), 'authenticated', 'authenticated'
) on conflict (id) do nothing;

insert into public.applications
  (user_id, company_name, job_title, platform_source, status, job_link, salary_range, location, applied_date, notes)
values
  ('00000000-0000-0000-0000-000000000001', 'Acme Corp', 'Junior Backend Developer', 'jobstreet',
   'pending_application', 'https://www.jobstreet.com.ph/job/12345678', '₱25,000 – ₱32,000/month',
   'Makati City', current_date - 3, 'Applied through JobStreet quick apply.'),
  ('00000000-0000-0000-0000-000000000001', 'Globex', 'Cloud Engineer (Entry Level)', 'linkedin',
   'scheduled_for_interview', 'https://www.linkedin.com/jobs/view/87654321', 'Competitive',
   'Remote (PH)', current_date - 10, 'Initial screening call went well. Technical interview set for Friday 2PM.'),
  ('00000000-0000-0000-0000-000000000001', 'Initech', 'Software Engineer I', 'indeed',
   'rejected', 'https://ph.indeed.com/viewjob?jk=abcdef', null, 'Taguig City',
   current_date - 21, 'Rejected after final round — feedback was they wanted more .NET experience.');
