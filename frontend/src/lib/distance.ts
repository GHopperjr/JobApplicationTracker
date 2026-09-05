export type Coordinates = { latitude: number; longitude: number };

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Pure arithmetic, no I/O — once both points have coordinates, this is the
// entire cost of showing a distance (docs/11-navigation-and-distance.md).
export function haversineKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// '4.2 km' below 10, '18 km' at or above — precision only matters up close.
// Metric only; the app's whole context is Philippine.
export function formatKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

// '~22 min by car'. Input is seconds — OSRM's `duration` unit.
export function formatDuration(seconds: number): string {
  return `~${Math.round(seconds / 60)} min by car`;
}
