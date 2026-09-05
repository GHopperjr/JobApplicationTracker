import type { ApplicationStatus } from './status';

export const STALE_THRESHOLD_DAYS_DEFAULT = 14;
export const STALE_THRESHOLD_STORAGE_KEY = 'jat.staleThresholdDays';

// Terminal statuses are never stale — a Rejected application sitting untouched
// for six months is not a missed follow-up, it's just finished.
const TERMINAL: readonly ApplicationStatus[] = ['rejected', 'accepted'];

export function isStale(
  application: { status: ApplicationStatus; status_changed_at: string; is_archived: boolean },
  thresholdDays: number = STALE_THRESHOLD_DAYS_DEFAULT
): boolean {
  if (application.is_archived) return false;
  if (TERMINAL.includes(application.status)) return false;
  const changed = new Date(application.status_changed_at).getTime();
  return Date.now() - changed > thresholdDays * 24 * 60 * 60 * 1000;
}

export function daysSinceStatusChange(statusChangedAt: string): number {
  return Math.floor((Date.now() - new Date(statusChangedAt).getTime()) / 86_400_000);
}
