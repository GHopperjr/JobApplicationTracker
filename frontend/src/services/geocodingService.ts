import type { Coordinates } from '../lib/distance';

const PHOTON_URL = 'https://photon.komoot.io/api/';

type PhotonProperties = {
  name?: string;
  housenumber?: string;
  street?: string;
  locality?: string;
  district?: string;
  city?: string;
  state?: string;
  osm_type?: string;
  osm_id?: number;
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: PhotonProperties;
};

export type PlaceSuggestion = {
  id: string;
  /** A clean, human-readable line built from Photon's structured fields —
   * what fills the input when a suggestion is picked. */
  address: string;
  /** The place's own name, e.g. "PNB" — present only when the underlying
   * OSM entry has one (a bank, a mall, a named building). */
  name: string | null;
  coordinates: Coordinates;
};

// Most-specific-to-least-specific, matching how someone reads an address
// aloud. Deliberately not Nominatim's old `display_name` shape — Photon
// doesn't return one, so this is built from its structured `properties`.
function formatDisplayAddress(properties: PhotonProperties): string {
  const streetLine =
    properties.housenumber && properties.street
      ? `${properties.housenumber} ${properties.street}`
      : properties.street;

  const parts = [properties.name, streetLine, properties.locality, properties.district, properties.city, properties.state].filter(
    (part): part is string => Boolean(part)
  );

  // A named POI's own city/street sometimes repeats verbatim across two of
  // these fields (e.g. name === city for a locality match) — dedupe rather
  // than show it twice.
  return Array.from(new Set(parts)).join(', ');
}

function toSuggestion(feature: PhotonFeature): PlaceSuggestion | null {
  const [longitude, latitude] = feature.geometry.coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const address = formatDisplayAddress(feature.properties);
  if (!address) return null;

  return {
    id: `${feature.properties.osm_type ?? ''}${feature.properties.osm_id ?? ''}` || address,
    address,
    name: feature.properties.name ?? null,
    coordinates: { latitude, longitude },
  };
}

/**
 * Free-text place search against Photon (komoot.io) — a free, no-API-key,
 * OSM-data-based geocoder. Returns `[]` rather than throwing on any failure
 * (empty input, network error, non-200, no match): this backs a live
 * search-as-you-type picker, where a failed lookup should just show no
 * suggestions, never an error.
 *
 * Photon is explicitly built for incremental/autocomplete-style queries,
 * unlike Nominatim (which this app does not use — see geocodeAddress).
 */
export async function searchPlaces(query: string, limit = 5): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const url = `${PHOTON_URL}?q=${encodeURIComponent(trimmed)}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = (await response.json()) as { features?: PhotonFeature[] };
    return (data.features ?? [])
      .map(toSuggestion)
      .filter((suggestion): suggestion is PlaceSuggestion => suggestion !== null);
  } catch {
    return [];
  }
}

/**
 * Resolves a single address to a point — the write-time fallback used when
 * a row is saved without going through the search-as-you-type picker (a
 * pasted address, or an edit that doesn't reopen the picker). One of only
 * two modules in the app allowed to fail silently (the other is
 * routingService): a geocoding failure must never block the write it
 * accompanies, and every consumer already has a "no coordinates" branch for
 * addresses that don't resolve (docs/11-navigation-and-distance.md).
 *
 * `limit=1` is deliberate here — this is the no-picker fallback path, which
 * still doesn't offer a "did you mean?" list; it either resolves to one
 * point or it does not resolve.
 */
export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const [first] = await searchPlaces(address, 1);
  return first?.coordinates ?? null;
}
