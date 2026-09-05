import type { Database } from '../types/database.types';

export type ApplicationStatus = Database['public']['Enums']['application_status'];

// `as const` and NO type annotation — both matter. zod's z.enum() requires a
// readonly tuple of string literals; an `ApplicationStatus[]` annotation
// widens this to a mutable string[]-shaped array and z.enum(STATUS_VALUES)
// then fails to compile.
export const STATUS_VALUES = [
  'pending_application',
  'scheduled_for_interview',
  'interviewed',
  'rejected',
  'accepted',
] as const;

// Kanban column order. Identical to STATUS_VALUES today and kept as a
// separate export: column order is a presentation decision, enum membership
// is a schema fact, and they are free to diverge later.
export const STATUS_ORDER: readonly ApplicationStatus[] = STATUS_VALUES;

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending_application: 'Pending Application',
  scheduled_for_interview: 'Scheduled for Interview',
  interviewed: 'Interviewed',
  rejected: 'Rejected',
  accepted: 'Accepted',
};

export const STATUS_STYLES: Record<
  ApplicationStatus,
  { dot: string; badge: string; ring: string; headerBorder: string }
> = {
  // Pending stays neutral even in the ring/header accent — a board full of
  // pending applications should still read as calm, not alarming
  // (docs/04-design-system.md).
  pending_application: {
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-700',
    ring: 'ring-slate-100',
    headerBorder: 'border-slate-300',
  },
  scheduled_for_interview: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700',
    ring: 'ring-blue-100',
    headerBorder: 'border-blue-500/70',
  },
  interviewed: {
    dot: 'bg-violet-500',
    badge: 'bg-violet-50 text-violet-700',
    ring: 'ring-violet-100',
    headerBorder: 'border-violet-500/70',
  },
  rejected: {
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700',
    ring: 'ring-rose-100',
    headerBorder: 'border-rose-500/70',
  },
  accepted: {
    dot: 'bg-emerald-600',
    badge: 'bg-emerald-50 text-emerald-700',
    ring: 'ring-emerald-100',
    headerBorder: 'border-emerald-500/70',
  },
};
