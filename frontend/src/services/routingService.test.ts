import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDrivingRoute } from './routingService';

const HOME = { latitude: 14.5995, longitude: 120.9842 };
const OFFICE = { latitude: 14.5547, longitude: 121.0244 };

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(implementation: () => Promise<unknown> | never) {
  const fetchMock = vi.fn(implementation);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('getDrivingRoute', () => {
  it('sends coordinates to OSRM as lng,lat — the reverse of how they are stored', async () => {
    // The single most common OSRM integration bug, so the assertion is on
    // the URL itself (docs/11-navigation-and-distance.md).
    const fetchMock = stubFetch(async () => ({
      ok: true,
      json: async () => ({ routes: [{ duration: 1320, distance: 5347 }] }),
    }));

    await getDrivingRoute(HOME, OFFICE);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://router.project-osrm.org/route/v1/driving/120.9842,14.5995;121.0244,14.5547?overview=false'
    );
  });

  it('returns the first route’s duration (seconds) and distance (metres)', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ routes: [{ duration: 1320, distance: 5347 }] }) }));
    await expect(getDrivingRoute(HOME, OFFICE)).resolves.toEqual({
      durationSeconds: 1320,
      distanceMeters: 5347,
    });
  });

  it('returns null on a non-200 rather than throwing', async () => {
    stubFetch(async () => ({ ok: false, json: async () => ({}) }));
    await expect(getDrivingRoute(HOME, OFFICE)).resolves.toBeNull();
  });

  it('returns null when the network rejects rather than throwing', async () => {
    stubFetch(async () => {
      throw new Error('network down');
    });
    await expect(getDrivingRoute(HOME, OFFICE)).resolves.toBeNull();
  });

  it('returns null when OSRM answers with no routes', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ routes: [] }) }));
    await expect(getDrivingRoute(HOME, OFFICE)).resolves.toBeNull();
  });

  it('returns null if a route is missing duration or distance', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ routes: [{ duration: 1320 }] }) }));
    await expect(getDrivingRoute(HOME, OFFICE)).resolves.toBeNull();
  });
});
