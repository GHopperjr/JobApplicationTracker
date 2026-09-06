import { afterEach, describe, expect, it } from 'vitest';
import { computeExperienceLevel, monthsSince } from './experienceLevel';

// Constructed from local (year, month, day) components, not ISO strings —
// both this file's `now` values and lib/experienceLevel.ts's own date
// parsing (parseDateOnly) work in local time, so round-tripping through
// local components on both sides keeps these tests deterministic
// regardless of the machine's own timezone.
const toDateOnly = (y: number, m: number, d: number): string =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

describe('computeExperienceLevel', () => {
  it('returns null when no graduation date is set', () => {
    expect(computeExperienceLevel(null)).toBeNull();
  });

  it('is fresh_grad exactly at the 12-month boundary', () => {
    const now = new Date(2026, 2, 15); // 2026-03-15
    expect(computeExperienceLevel(toDateOnly(2025, 3, 15), now)).toBe('fresh_grad');
  });

  it('is experienced one day past the 12-month boundary', () => {
    const now = new Date(2026, 2, 16); // 2026-03-16
    expect(computeExperienceLevel(toDateOnly(2025, 3, 15), now)).toBe('experienced');
  });

  it('is fresh_grad for a future graduation date', () => {
    const now = new Date(2026, 2, 15);
    expect(computeExperienceLevel(toDateOnly(2026, 6, 1), now)).toBe('fresh_grad');
  });

  it('is fresh_grad well within the window', () => {
    const now = new Date(2026, 2, 15);
    expect(computeExperienceLevel(toDateOnly(2025, 12, 1), now)).toBe('fresh_grad');
  });

  it('is experienced well past the window', () => {
    const now = new Date(2026, 2, 15);
    expect(computeExperienceLevel(toDateOnly(2020, 1, 1), now)).toBe('experienced');
  });

  it('computes identically regardless of the graduation month’s length', () => {
    // Jan 31 + 12 months clamps to Jan 31 the following year (no rollover
    // into February/March) — the cutoff itself, not this specific case,
    // is what exercises addCalendarMonths' clamping.
    const now = new Date(2027, 0, 31); // 2027-01-31
    expect(computeExperienceLevel(toDateOnly(2026, 1, 31), now)).toBe('fresh_grad');
  });
});

describe('timezone safety', () => {
  // graduation_date is the second date-only column in the app (after
  // applied_date) that can fall into the UTC-midnight parsing trap
  // lib/format.test.ts already guards against. Both this function's parsing
  // (parseDateOnly) and `now` are read via local Date getters throughout,
  // so the result must not depend on the machine's own timezone.
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it.each(['Asia/Manila', 'America/Los_Angeles', 'UTC'])(
    'computes the same result under TZ=%s',
    (tz) => {
      process.env.TZ = tz;
      const now = new Date(2026, 2, 15);
      expect(computeExperienceLevel(toDateOnly(2025, 3, 15), now)).toBe('fresh_grad');
      expect(monthsSince(toDateOnly(2025, 3, 15), now)).toBe(12);
    }
  );
});

describe('monthsSince', () => {
  it('returns exactly 12 for a date exactly one year ago, not 11.99', () => {
    const now = new Date(2026, 2, 15);
    expect(monthsSince(toDateOnly(2025, 3, 15), now)).toBe(12);
  });

  it('floors to whole months rather than rounding', () => {
    const now = new Date(2026, 2, 16); // one day past the 12-month mark
    expect(monthsSince(toDateOnly(2025, 3, 15), now)).toBe(12);
  });

  it('clamps a future graduation date to 0 rather than a negative number', () => {
    const now = new Date(2026, 2, 15);
    expect(monthsSince(toDateOnly(2026, 6, 1), now)).toBe(0);
  });
});
