import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocodeAddress } from './geocodingService';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(implementation: () => Promise<unknown> | never) {
  const fetchMock = vi.fn(implementation);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('geocodeAddress', () => {
  it('returns the first result’s coordinates as numbers', async () => {
    stubFetch(async () => ({
      ok: true,
      json: async () => [{ lat: '14.5995', lon: '120.9842' }],
    }));

    await expect(geocodeAddress('Manila City Hall')).resolves.toEqual({
      latitude: 14.5995,
      longitude: 120.9842,
    });
  });

  it('asks Nominatim for a single result — there is no "did you mean?" list', async () => {
    const fetchMock = stubFetch(async () => ({ ok: true, json: async () => [] }));

    await geocodeAddress('123 Rizal Street, Makati');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://nominatim.openstreetmap.org/search?q=123%20Rizal%20Street%2C%20Makati&format=jsonv2&limit=1'
    );
  });

  it('returns null when the address resolves to nothing', async () => {
    stubFetch(async () => ({ ok: true, json: async () => [] }));
    await expect(geocodeAddress('Remote')).resolves.toBeNull();
  });

  it('returns null on a non-200 rather than throwing', async () => {
    stubFetch(async () => ({ ok: false, json: async () => [] }));
    await expect(geocodeAddress('Anywhere')).resolves.toBeNull();
  });

  it('returns null when the network rejects rather than throwing', async () => {
    stubFetch(async () => {
      throw new Error('rate limited');
    });
    await expect(geocodeAddress('Manila')).resolves.toBeNull();
  });

  it('makes no request at all for an empty address', async () => {
    const fetchMock = stubFetch(async () => ({ ok: true, json: async () => [] }));

    await expect(geocodeAddress('   ')).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
