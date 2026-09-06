import type { Database } from '../types/database.types';

export type ExperienceLevel = Database['public']['Enums']['experience_level'];

export const EXPERIENCE_LEVEL_VALUES = ['fresh_grad', 'experienced'] as const;

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  fresh_grad: 'Fresh Graduate',
  experienced: 'Experienced',
};

export const EXPERIENCE_LEVEL_ORDER: readonly ExperienceLevel[] = EXPERIENCE_LEVEL_VALUES;

// The audience filter's three selectable states — one more than the enum
// itself has. 'unspecified' matches target_experience_level is null; it is
// a filter token, never a value written to that column
// (docs/13-profile-and-experience-filtering.md).
export const AUDIENCE_FILTER_VALUES = ['fresh_grad', 'experienced', 'unspecified'] as const;

export type AudienceFilterValue = (typeof AUDIENCE_FILTER_VALUES)[number];

export const AUDIENCE_FILTER_LABELS: Record<AudienceFilterValue, string> = {
  fresh_grad: 'Fresh-grad friendly',
  experienced: 'Experienced required',
  unspecified: 'Not specified',
};
