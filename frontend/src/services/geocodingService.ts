import type { Coordinates } from '../lib/distance';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Resolves a free-text address to a point via Nominatim's public server —
 * one of only two modules in the app allowed to fail silently (the other is
 * routingService). Returns `null` rather than throwing on every failure mode
 * (empty input, network error, non-200, no match): a geocoding failure must
 * never block the write it accompanies, and every consumer already has to
 * handle "no coordinates" for un-geocodable addresses regardless
 * (docs/11-navigation-and-distance.md).
 *
 * `limit=1` is deliberate — this never offers a "did you mean?" list; an
 * address either resolves to one point or it does not resolve.
 *
 * The `User-Agent` header cannot be set from a browser (a forbidden header
 * name) — Nominatim's usage policy accounts for this by accepting the
 * `Referer` header the browser sends automatically instead.
 */
export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  try {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(trimmed)}&format=jsonv2&limit=1`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const results = (await response.json()) as { lat: string; lon: string }[];
    const first = results[0];
    if (!first) return null;

    const latitude = Number(first.lat);
    const longitude = Number(first.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return { latitude, longitude };
  } catch {
    return null;
  }
}
