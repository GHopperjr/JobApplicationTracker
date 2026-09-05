import { describe, expect, it } from 'vitest';
import { daysSinceStatusChange, isStale } from './staleness';

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

describe('isStale', () => {
  it('is stale when a non-terminal status has not changed past the threshold', () => {
    const app = {
      status: 'pending_application' as const,
      status_changed_at: daysAgo(20),
      is_archived: false,
    };
    expect(isStale(app, 14)).toBe(true);
  });

  it('is not stale within the threshold', () => {
    const app = {
      status: 'pending_application' as const,
      status_changed_at: daysAgo(5),
      is_archived: false,
    };
    expect(isStale(app, 14)).toBe(false);
  });

  // The docs/06 "done when" criterion, verbatim: a Rejected application
  // untouched for a month shows no stale marker; a Pending one does.
  it('a terminal status is never stale, regardless of age', () => {
    const rejected = {
      status: 'rejected' as const,
      status_changed_at: daysAgo(60),
      is_archived: false,
    };
    const accepted = {
      status: 'accepted' as const,
      status_changed_at: daysAgo(60),
      is_archived: false,
    };
    expect(isStale(rejected, 14)).toBe(false);
    expect(isStale(accepted, 14)).toBe(false);
  });

  it('an archived application is never stale, regardless of status or age', () => {
    const app = {
      status: 'pending_application' as const,
      status_changed_at: daysAgo(60),
      is_archived: true,
    };
    expect(isStale(app, 14)).toBe(false);
  });

  it('defaults to the 14-day threshold when none is given', () => {
    const justOver = {
      status: 'pending_application' as const,
      status_changed_at: daysAgo(15),
      is_archived: false,
    };
    expect(isStale(justOver)).toBe(true);
  });
});

describe('daysSinceStatusChange', () => {
  it('rounds down to whole days', () => {
    expect(daysSinceStatusChange(daysAgo(18))).toBe(18);
  });
});
