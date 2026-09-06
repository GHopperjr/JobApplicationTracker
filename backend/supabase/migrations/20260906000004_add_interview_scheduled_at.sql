-- A guardrail on status changes (requested after testing doc 12's metrics
-- against manually-skipped statuses) prompts for an interview date/time
-- whenever an application moves into 'scheduled_for_interview'. This is a
-- real, editable field from here on — shown in the Detail View and editable
-- via the application form, not just captured once through the prompt.
--
-- timestamptz, not date: interview times are inherently timezone-sensitive
-- (docs/01-database-schema.md's own note), and a specific hour matters here
-- the way it doesn't for applied_date.
alter table public.applications
  add column interview_scheduled_at timestamptz;
