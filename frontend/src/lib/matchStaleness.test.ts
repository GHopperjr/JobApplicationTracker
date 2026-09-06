import { describe, expect, it } from 'vitest';
import { isMatchStale } from './matchStaleness';

describe('isMatchStale', () => {
  it('is not stale when no match has ever been calculated', () => {
    expect(isMatchStale(null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')).toBe(false);
  });

  it('is stale when the resume was uploaded after the match was calculated', () => {
    expect(
      isMatchStale(
        '2026-01-01T00:00:00.000Z',
        '2026-01-02T00:00:00.000Z',
        '2025-12-01T00:00:00.000Z'
      )
    ).toBe(true);
  });

  it('is stale when the application was updated after the match was calculated', () => {
    expect(
      isMatchStale(
        '2026-01-01T00:00:00.000Z',
        '2025-12-01T00:00:00.000Z',
        '2026-01-02T00:00:00.000Z'
      )
    ).toBe(true);
  });

  it('is fresh when the match postdates both the resume and the application update', () => {
    expect(
      isMatchStale(
        '2026-01-05T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z',
        '2026-01-02T00:00:00.000Z'
      )
    ).toBe(false);
  });

  it('is fresh with no resume upload timestamp on record', () => {
    expect(isMatchStale('2026-01-05T00:00:00.000Z', null, '2026-01-01T00:00:00.000Z')).toBe(false);
  });
});
