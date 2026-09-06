import { describe, expect, it } from 'vitest';
import type { Application } from '../services/applicationsService';
import type { StatusHistory } from '../services/statusHistoryService';
import {
  computeFunnel,
  computeGoalProgress,
  computePlatformBreakdown,
  computeStatusBreakdown,
  filterCohort,
  reachedInterviewStage,
} from './metrics';

const application = (overrides: Partial<Application> = {}) =>
  ({
    id: 'app-1',
    company_name: 'Acme',
    status: 'pending_application',
    platform_source: 'linkedin',
    created_at: '2026-06-15T00:00:00.000Z',
    ...overrides,
  }) as Application;

const historyRow = (overrides: Partial<StatusHistory> = {}) =>
  ({
    id: 'hist-1',
    application_id: 'app-1',
    from_status: null,
    to_status: 'pending_application',
    changed_at: '2026-06-15T00:00:00.000Z',
    ...overrides,
  }) as StatusHistory;

describe('reachedInterviewStage', () => {
  it('counts an application currently rejected whose history contains interviewed', () => {
    const history = [
      historyRow({ to_status: 'pending_application' }),
      historyRow({ to_status: 'interviewed' }),
      historyRow({ to_status: 'rejected' }),
    ];
    expect(reachedInterviewStage('app-1', history)).toBe(true);
  });

  it('is false for an application whose history never left pending', () => {
    const history = [historyRow({ to_status: 'pending_application' })];
    expect(reachedInterviewStage('app-1', history)).toBe(false);
  });

  it('only looks at rows for the given application id', () => {
    const history = [historyRow({ application_id: 'app-2', to_status: 'interviewed' })];
    expect(reachedInterviewStage('app-1', history)).toBe(false);
  });
});

describe('filterCohort', () => {
  // Constructed from local (year, month, day, ...) components, not an ISO
  // string, and compared against timestamps built the same way below — both
  // this and `filterCohort` read calendar-month membership via local Date
  // getters, so round-tripping through local components on both sides keeps
  // the test deterministic regardless of the machine's own timezone.
  const now = new Date(2026, 5, 15, 12, 0, 0);

  it('includes an application created on the first instant of the month', () => {
    const apps = [application({ created_at: new Date(2026, 5, 1, 0, 0, 0).toISOString() })];
    expect(filterCohort(apps, 'month', now)).toHaveLength(1);
  });

  it('excludes an application created a second before the month started', () => {
    const apps = [application({ created_at: new Date(2026, 4, 31, 23, 59, 59).toISOString() })];
    expect(filterCohort(apps, 'month', now)).toHaveLength(0);
  });

  it('last30 includes an application from 29 days ago and excludes one from 31', () => {
    const apps = [
      application({ id: 'recent', created_at: '2026-05-17T12:00:00.000Z' }),
      application({ id: 'old', created_at: '2026-05-15T00:00:00.000Z' }),
    ];
    const result = filterCohort(apps, 'last30', now);
    expect(result.map((a) => a.id)).toEqual(['recent']);
  });

  it('all includes everything regardless of date', () => {
    const apps = [application({ created_at: '2020-01-01T00:00:00.000Z' })];
    expect(filterCohort(apps, 'all', now)).toHaveLength(1);
  });
});

describe('computeStatusBreakdown', () => {
  it('counts every status and computes whole-number percentages', () => {
    const apps = [
      application({ id: '1', status: 'pending_application' }),
      application({ id: '2', status: 'pending_application' }),
      application({ id: '3', status: 'interviewed' }),
      application({ id: '4', status: 'accepted' }),
    ];
    const breakdown = computeStatusBreakdown(apps);
    expect(breakdown.find((b) => b.status === 'pending_application')).toMatchObject({
      count: 2,
      pct: 50,
    });
    expect(breakdown.find((b) => b.status === 'scheduled_for_interview')).toMatchObject({
      count: 0,
      pct: 0,
    });
  });

  it('returns null percentages for an empty cohort, never NaN', () => {
    const breakdown = computeStatusBreakdown([]);
    expect(breakdown.every((b) => b.pct === null)).toBe(true);
  });
});

describe('computeFunnel', () => {
  it('an application that jumped pending -> accepted counts in both later stages', () => {
    const apps = [application({ id: 'app-1', status: 'accepted' })];
    const history = [
      historyRow({ application_id: 'app-1', to_status: 'pending_application' }),
      historyRow({ application_id: 'app-1', to_status: 'accepted' }),
    ];
    const funnel = computeFunnel(apps, history);
    expect(funnel.find((s) => s.label === 'Reached interview stage')?.count).toBe(1);
    expect(funnel.find((s) => s.label === 'Offer accepted')?.count).toBe(1);
  });

  it('returns null percentages against an empty cohort, not NaN', () => {
    const funnel = computeFunnel([], []);
    expect(funnel.every((s) => s.pct === null)).toBe(true);
    expect(funnel.every((s) => s.count === 0)).toBe(true);
  });

  it('applied is always 100% of a non-empty cohort', () => {
    const apps = [application({ id: '1' }), application({ id: '2' })];
    const funnel = computeFunnel(apps, []);
    expect(funnel.find((s) => s.label === 'Applied')).toMatchObject({ count: 2, pct: 100 });
  });
});

describe('computePlatformBreakdown', () => {
  it('sorts by volume descending and omits unused platforms', () => {
    const apps = [
      application({ id: '1', platform_source: 'jobstreet' }),
      application({ id: '2', platform_source: 'jobstreet' }),
      application({ id: '3', platform_source: 'referral' }),
    ];
    const history = [historyRow({ application_id: '3', to_status: 'interviewed' })];

    const breakdown = computePlatformBreakdown(apps, history);

    expect(breakdown.map((b) => b.platform)).toEqual(['jobstreet', 'referral']);
    expect(breakdown.find((b) => b.platform === 'referral')).toMatchObject({
      applied: 1,
      reachedInterviewPct: 100,
    });
    expect(breakdown.some((b) => b.platform === 'linkedin')).toBe(false);
  });
});

describe('computeGoalProgress', () => {
  it('caps the bar percentage at 100 while keeping the real count and goal', () => {
    expect(computeGoalProgress(24, 20)).toEqual({ count: 24, goal: 20, barPct: 100 });
  });

  it('reflects partial progress below the goal', () => {
    expect(computeGoalProgress(5, 20)).toEqual({ count: 5, goal: 20, barPct: 25 });
  });
});
