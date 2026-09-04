import type { Database } from '../types/database.types';

export type WorkSetup = Database['public']['Enums']['work_setup'];

export const WORK_SETUP_VALUES = ['remote', 'hybrid', 'onsite'] as const;

export const WORK_SETUP_LABELS: Record<WorkSetup, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'Full On-site',
};

export const WORK_SETUP_ORDER: readonly WorkSetup[] = WORK_SETUP_VALUES;
