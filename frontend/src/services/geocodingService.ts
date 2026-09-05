import type { Coordinates } from '../lib/distance';

const PHOTON_URL = 'https://photon.komoot.io/api/';

/**
 * Resolves a free-text address to a point via Photon (komoot.io) — a free,
 * no-API-key, OSM-data-based geocoder. One of only two modules in the app
 * allowed to fail silently (the other is routingService). Returns `null`
 * rather than throwing on every failure mode (empty input, network error,
 * non-200, no match): a geocoding failure must never block the write it
 * accompanies, and every consumer already has to handle "no coordinates"
 * for un-geocodable addresses regardless (docs/11-navigation-and-distance.md).
 *
 * **Not Nominatim**, despite the original spec. Nominatim's public server
 * sends no `Access-Control-Allow-Origin` header at all — verified directly
 * against the live endpoint — so a browser `fetch()` to it is blocked by
 * CORS and silently returns nothing, every time. Photon is built on the
 * same OSM data and does send `Access-Control-Allow-Origin: *`, so it
 * actually works from a browser.
 *
 * `limit=1` is deliberate — this never offers a "did you mean?" list; an
 * address either resolves to one point or it does not resolve.
 */
export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  try {
    const url = `${PHOTON_URL}?q=${encodeURIComponent(trimmed)}&limit=1`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = (await response.json()) as {
      features?: { geometry: { coordinates: [number, number] } }[];
    };
    const first = data.features?.[0];
    if (!first) return null;

    // GeoJSON coordinate order is [longitude, latitude] — the reverse of
    // Nominatim's separate lat/lon fields, and the same trap OSRM has.
    const [longitude, latitude] = first.geometry.coordinates;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return { latitude, longitude };
  } catch {
    return null;
  }
}
