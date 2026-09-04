-- Enum types for application status and platform source.
-- Values are snake_case identifiers; display labels live in the frontend
-- (src/constants/status.ts, src/constants/platforms.ts) so copy can change
-- without a migration. See docs/01-database-schema.md.

create type application_status as enum (
  'pending_application',
  'scheduled_for_interview',
  'interviewed',
  'rejected',
  'accepted'
);

create type platform_source as enum (
  'jobstreet',
  'linkedin',
  'indeed',
  'company_website',
  'referral',
  'other'
);
