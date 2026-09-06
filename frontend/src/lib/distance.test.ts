import { describe, expect, it } from 'vitest';
import { formatDuration, formatKm, metersToKm } from './distance';

describe('formatKm', () => {
  // The boundary called out in docs/11: one decimal below 10 km, whole
  // numbers at or above it.
  it('keeps one decimal below 10 km', () => {
    expect(formatKm(9.94)).toBe('9.9 km');
    expect(formatKm(4.21)).toBe('4.2 km');
  });

  it('rounds to whole kilometres at 10 and above', () => {
    expect(formatKm(10.4)).toBe('10 km');
    expect(formatKm(17.6)).toBe('18 km');
  });
});

describe('formatDuration', () => {
  it('renders OSRM seconds as whole minutes by car', () => {
    expect(formatDuration(1320)).toBe('~22 min by car');
    expect(formatDuration(95)).toBe('~2 min by car');
  });
});

describe('metersToKm', () => {
  it('converts OSRM’s metre distance to kilometres', () => {
    // The real figures from a live-verified route (docs/11).
    expect(metersToKm(5346.9)).toBeCloseTo(5.3469, 4);
  });
});
