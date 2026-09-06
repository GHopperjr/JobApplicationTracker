import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocodeAddress, searchPlaces } from './geocodingService';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(implementation: () => Promise<unknown> | never) {
  const fetchMock = vi.fn(implementation);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

// A real Photon feature always carries `properties` — this is what the
// live "PNB Makati" query actually returned.
const pnbFeature = {
  type: 'Feature',
  properties: {
    osm_type: 'N',
    osm_id: 674091320,
    name: 'PNB',
    housenumber: '6754',
    street: 'Ayala Avenue',
    locality: 'San Lorenzo',
    city: 'Makati',
    state: 'Metro Manila',
  },
  geometry: { type: 'Point', coordinates: [121.0235158, 14.5548495] },
};

const featureCollection = (...features: unknown[]) => ({ type: 'FeatureCollection', features });

describe('searchPlaces', () => {
  it('formats a display address from Photon’s structured properties, most-specific first', async () => {
    stubFetch(async () => ({ ok: true, json: async () => featureCollection(pnbFeature) }));

    const [result] = await searchPlaces('PNB Makati');

    expect(result).toEqual({
      id: 'N674091320',
      address: 'PNB, 6754 Ayala Avenue, San Lorenzo, Makati, Metro Manila',
      name: 'PNB',
      coordinates: { latitude: 14.5548495, longitude: 121.0235158 },
    });
  });

  it('passes the requested limit through to the query', async () => {
    const fetchMock = stubFetch(async () => ({ ok: true, json: async () => featureCollection() }));

    await searchPlaces('Ayala Avenue', 5);

    expect(fetchMock).toHaveBeenCalledWith('https://photon.komoot.io/api/?q=Ayala%20Avenue&limit=5');
  });

  it('drops a feature with no derivable address text', async () => {
    stubFetch(async () => ({
      ok: true,
      json: async () => featureCollection({ properties: {}, geometry: { coordinates: [121, 14.5] } }),
    }));

    await expect(searchPlaces('something odd')).resolves.toEqual([]);
  });

  it('returns [] rather than throwing on a non-200 or a network rejection', async () => {
    stubFetch(async () => ({ ok: false, json: async () => ({}) }));
    await expect(searchPlaces('Anywhere')).resolves.toEqual([]);
  });

  it('makes no request at all for an empty query', async () => {
    const fetchMock = stubFetch(async () => ({ ok: true, json: async () => featureCollection() }));
    await expect(searchPlaces('   ')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('geocodeAddress', () => {
  it('returns the first result’s coordinates', async () => {
    stubFetch(async () => ({ ok: true, json: async () => featureCollection(pnbFeature) }));

    await expect(geocodeAddress('PNB Building Ayala Avenue Makati')).resolves.toEqual({
      latitude: 14.5548495,
      longitude: 121.0235158,
    });
  });

  it('asks for a single result — there is no "did you mean?" list on the write-time fallback', async () => {
    const fetchMock = stubFetch(async () => ({ ok: true, json: async () => featureCollection() }));

    await geocodeAddress('123 Rizal Street, Makati');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://photon.komoot.io/api/?q=123%20Rizal%20Street%2C%20Makati&limit=1'
    );
  });

  it('returns null when the address resolves to nothing', async () => {
    stubFetch(async () => ({ ok: true, json: async () => featureCollection() }));
    await expect(geocodeAddress('Remote')).resolves.toBeNull();
  });

  it('returns null on a non-200 rather than throwing', async () => {
    stubFetch(async () => ({ ok: false, json: async () => ({}) }));
    await expect(geocodeAddress('Anywhere')).resolves.toBeNull();
  });

  it('returns null when the network rejects rather than throwing', async () => {
    stubFetch(async () => {
      throw new Error('rate limited');
    });
    await expect(geocodeAddress('Manila')).resolves.toBeNull();
  });

  it('makes no request at all for an empty address', async () => {
    const fetchMock = stubFetch(async () => ({ ok: true, json: async () => featureCollection() }));
    await expect(geocodeAddress('   ')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
