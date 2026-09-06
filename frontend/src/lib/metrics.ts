import type { PlatformSource } from '../constants/platforms';
import { STATUS_ORDER, type ApplicationStatus } from '../constants/status';
import type { MetricsPeriod } from '../constants/metricsPeriod';
import type { Application } from '../services/applicationsService';
import type { StatusHistory } from '../services/statusHistoryService';

// Depth is expressed as explicit sets of statuses ever reached, never as an
// ordinal comparison — application_status is declared in Kanban column
// order (pending_application, scheduled_for_interview, interviewed,
// rejected, accepted), so rejected sorts after interviewed despite not
// implying it, and accepted sorts last despite being reachable directly
// (docs/12-interview-metrics.md).
const REACHED_INTERVIEW_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  'scheduled_for_interview',
  'interviewed',
  'accepted',
]);
const REACHED_ACCEPTED_STATUSES: ReadonlySet<ApplicationStatus> = new Set(['accepted']);

function everReached(
  applicationId: string,
  history: StatusHistory[],
  statuses: ReadonlySet<ApplicationStatus>
): boolean {
  return history.some((h) => h.application_id === applicationId && statuses.has(h.to_status));
}

/**
 * True when this application's history ever transitioned to a
 * scheduled-or-later status — including one currently `rejected`, which is
 * the entire reason this reads `status_history` instead of
 * `applications.status` (docs/12-interview-metrics.md).
 */
export function reachedInterviewStage(applicationId: string, history: StatusHistory[]): boolean {
  return everReached(applicationId, history, REACHED_INTERVIEW_STATUSES);
}

function reachedAcceptedStage(applicationId: string, history: StatusHistory[]): boolean {
  return everReached(applicationId, history, REACHED_ACCEPTED_STATUSES);
}

function isInPeriod(createdAt: string, period: MetricsPeriod, now: Date): boolean {
  if (period === 'all') return true;
  const created = new Date(createdAt);
  if (period === 'last30') {
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return created >= cutoff;
  }
  // 'month': calendar-month membership, not a rolling 30 days — an
  // application created a second before midnight on the 1st is in the
  // previous month, not this one.
  return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
}

export function filterCohort(
  applications: Application[],
  period: MetricsPeriod,
  now: Date = new Date()
): Application[] {
  return applications.filter((a) => isInPeriod(a.created_at, period, now));
}

export type StatusBreakdownEntry = {
  status: ApplicationStatus;
  count: number;
  /** null for an empty cohort — never NaN, never a misleading 0%. */
  pct: number | null;
};

export function computeStatusBreakdown(applications: Application[]): StatusBreakdownEntry[] {
  const total = applications.length;
  const counts = new Map<ApplicationStatus, number>(STATUS_ORDER.map((s) => [s, 0]));
  for (const app of applications) counts.set(app.status, (counts.get(app.status) ?? 0) + 1);

  return STATUS_ORDER.map((status) => {
    const count = counts.get(status) ?? 0;
    return { status, count, pct: total === 0 ? null : Math.round((count / total) * 100) };
  });
}

export type FunnelStage = {
  label: string;
  count: number;
  pct: number | null;
};

/**
 * Three stages, monotonic by construction — each stage's set includes the
 * stages beyond it, so an application that jumped straight from Pending to
 * Accepted (the app permits arbitrary status changes) still counts toward
 * "reached interview," rather than producing a funnel where a later stage
 * outnumbers an earlier one (docs/12-interview-metrics.md).
 */
export function computeFunnel(applications: Application[], history: StatusHistory[]): FunnelStage[] {
  const applied = applications.length;
  const reachedInterview = applications.filter((a) =>
    reachedInterviewStage(a.id, history)
  ).length;
  const accepted = applications.filter((a) => reachedAcceptedStage(a.id, history)).length;

  const pct = (count: number) => (applied === 0 ? null : Math.round((count / applied) * 100));

  return [
    { label: 'Applied', count: applied, pct: applied === 0 ? null : 100 },
    { label: 'Reached interview stage', count: reachedInterview, pct: pct(reachedInterview) },
    { label: 'Offer accepted', count: accepted, pct: pct(accepted) },
  ];
}

export type PlatformBreakdownEntry = {
  platform: PlatformSource;
  applied: number;
  reachedInterviewPct: number;
};

/**
 * Sorted by volume descending so platforms carrying real weight lead the
 * list — a single lucky referral never outranks a platform with real
 * volume just for scoring 100%. Platforms with zero applications in the
 * cohort are omitted entirely: a platform never used is not a platform
 * performing badly (docs/12-interview-metrics.md).
 */
export function computePlatformBreakdown(
  applications: Application[],
  history: StatusHistory[]
): PlatformBreakdownEntry[] {
  const byPlatform = new Map<PlatformSource, Application[]>();
  for (const app of applications) {
    const list = byPlatform.get(app.platform_source);
    if (list) list.push(app);
    else byPlatform.set(app.platform_source, [app]);
  }

  const entries: PlatformBreakdownEntry[] = [];
  for (const [platform, apps] of byPlatform) {
    const reached = apps.filter((a) => reachedInterviewStage(a.id, history)).length;
    // apps.length is always >= 1 here — a Map entry only exists because at
    // least one application used this platform.
    entries.push({ platform, applied: apps.length, reachedInterviewPct: Math.round((reached / apps.length) * 100) });
  }

  return entries.sort((a, b) => b.applied - a.applied);
}

export type GoalProgress = {
  count: number;
  goal: number;
  /** Capped at 100 for bar width — `count` and `goal` stay the real numbers,
   * so exceeding a goal reads as beating it (24 of 20), not as a full bar
   * with no way to tell by how much. */
  barPct: number;
};

export function computeGoalProgress(count: number, goal: number): GoalProgress {
  return { count, goal, barPct: Math.min(100, Math.round((count / goal) * 100)) };
}
