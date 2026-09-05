import { describe, expect, it } from 'vitest';
import { formatDuration, formatKm, haversineKm } from './distance';

const MANILA = { latitude: 14.5995, longitude: 120.9842 };
const CEBU = { latitude: 10.3157, longitude: 123.8854 };
const MAKATI = { latitude: 14.5547, longitude: 121.0244 };

describe('haversineKm', () => {
  // Known city-pair distances, ±1% (docs/11-navigation-and-distance.md).
  it('matches a known long-haul city pair', () => {
    const km = haversineKm(MANILA, CEBU);
    expect(km).toBeGreaterThan(566);
    expect(km).toBeLessThan(578);
  });

  it('matches a known short metro-area pair', () => {
    // ~6.6 km: Δlat ≈ 4.99 km, Δlng ≈ 4.33 km at this latitude.
    const km = haversineKm(MANILA, MAKATI);
    expect(km).toBeGreaterThan(6.53);
    expect(km).toBeLessThan(6.67);
  });

  it('returns 0 for identical points', () => {
    expect(haversineKm(MANILA, MANILA)).toBe(0);
  });

  it('returns roughly half the earth’s circumference for antipodal points', () => {
    const km = haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 });
    expect(km).toBeGreaterThan(20_000);
    expect(km).toBeLessThan(20_030);
  });

  it('is symmetric', () => {
    expect(haversineKm(MANILA, CEBU)).toBeCloseTo(haversineKm(CEBU, MANILA), 6);
  });
});

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
