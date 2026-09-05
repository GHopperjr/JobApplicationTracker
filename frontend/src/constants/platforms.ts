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

// Platform is not a status — the hues below are chosen to stay visually
// distinct from STATUS_STYLES' palette (slate/blue/violet/rose/emerald) so a
// glance at a card's meta row never gets mistaken for a status signal. Used
// only on the Kanban card's platform dot (docs/04-design-system.md); the
// table view keeps platform as plain text.
export const PLATFORM_STYLES: Record<PlatformSource, { dot: string }> = {
  jobstreet: { dot: 'bg-purple-500' },
  linkedin: { dot: 'bg-sky-500' },
  indeed: { dot: 'bg-teal-500' },
  company_website: { dot: 'bg-slate-500' },
  referral: { dot: 'bg-amber-500' },
  other: { dot: 'bg-slate-400' },
};
