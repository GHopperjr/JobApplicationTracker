import { z } from 'zod';
import { EXPERIENCE_LEVEL_VALUES } from '../constants/experienceLevel';
import { PLATFORM_VALUES } from '../constants/platforms';
import { STATUS_VALUES } from '../constants/status';
import { WORK_SETUP_VALUES } from '../constants/workSetup';
import { HTTP_URL_PATTERN } from './url';

// Both constants are declared `as const` (readonly tuples) — z.enum() will
// not accept a mutable string[].
const httpUrl = z
  .string()
  .trim()
  // z.url() alone accepts ftp:// and mailto:, which the database check
  // constraint then rejects with an opaque 23514. Enforce the protocol here
  // so the user gets the real message.
  .refine((v) => HTTP_URL_PATTERN.test(v), {
    message: 'Enter a valid URL starting with http:// or https://',
  });

// Optional fields use `z.union([z.literal(''), ...])` rather than
// `.optional()`: react-hook-form always supplies every key with a defined
// string ('' for "empty"), it never omits a key the way `.optional()`
// expects. Using `.optional()` here would type the field as `string |
// undefined`, which doesn't match ApplicationFormValues (types/application.ts)
// where every field is always a defined string — so the two intentionally
// describe the same shape.
export const applicationSchema = z.object({
  company_name: z.string().trim().min(1, 'Company name is required'),
  job_title: z.string().trim().min(1, 'Job title is required'),
  platform_source: z.enum(PLATFORM_VALUES),
  status: z.enum(STATUS_VALUES),

  // Coerced '' -> null before reaching Postgres, in the service layer's
  // normalizeOptionalFields. Without that step, EVERY application saved
  // without a job link fails the check constraint.
  job_link: z.union([z.literal(''), httpUrl]),
  salary_range: z.string().trim().max(100),
  location: z.string().trim().max(200),
  work_setup: z.union([z.literal(''), z.enum(WORK_SETUP_VALUES)]),
  applied_date: z.union([z.literal(''), z.iso.date()]),
  notes: z.string().max(5000),

  // datetime-local's own value ("2026-09-10T14:30"), not a full ISO string —
  // converted to one at the service boundary. No stricter format check: the
  // native input already constrains what a user can type into it.
  interview_scheduled_at: z.string(),

  // Who the job posting was aimed at — never required (docs/13-profile-and-
  // experience-filtering.md: a mandatory field here would contradict the
  // fast-add guarantee).
  target_experience_level: z.union([z.literal(''), z.enum(EXPERIENCE_LEVEL_VALUES)]),
});

// Mirrors saved_locations' own check constraints (docs/11's schema) so the
// user gets the real message instead of an opaque 23514.
export const savedLocationSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(60, 'Keep the label under 60 characters'),
  address: z
    .string()
    .trim()
    .min(1, 'Address is required')
    .max(300, 'Keep the address under 300 characters'),
});

export const credentialsSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  // No composition rules — forced symbols/numbers measurably push users
  // toward weaker, more predictable passwords (docs/05 F1).
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const wholeNumber = z.string().regex(/^\d*$/, 'Must be a whole number');

// Validates the Low/High sub-fields of the salary composite control
// (SalaryRangeField). Kept separate from `applicationSchema`: the low/high
// split is purely a form-entry convenience, not a stored shape — the two
// values are combined into a single string before it ever reaches
// applicationSchema or the database (docs/01-database-schema.md keeps
// salary_range itself as free text, e.g. "Competitive" or "DOE").
export const salaryRangeInputSchema = z
  .object({
    low: wholeNumber,
    high: wholeNumber,
  })
  .refine((data) => !data.low || !data.high || Number(data.high) >= Number(data.low), {
    message: 'High must be greater than or equal to Low',
    path: ['high'],
  });
