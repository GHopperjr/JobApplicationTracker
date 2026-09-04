import type { Database } from '../types/database.types';

export type PlatformSource = Database['public']['Enums']['platform_source'];

export const PLATFORM_VALUES = [
  'jobstreet',
  'linkedin',
  'indeed',
  'company_website',
  'referral',
  'other',
] as const;

export const PLATFORM_LABELS: Record<PlatformSource, string> = {
  jobstreet: 'JobStreet',
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  company_website: 'Company Website',
  referral: 'Referral',
  other: 'Other',
};

// Order shown in the form's Select — most-used first, 'other' last.
export const PLATFORM_ORDER: readonly PlatformSource[] = PLATFORM_VALUES;
