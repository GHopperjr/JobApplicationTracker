export type Coordinates = { latitude: number; longitude: number };

// '4.2 km' below 10, '18 km' at or above — precision only matters up close.
// Metric only; the app's whole context is Philippine.
export function formatKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

// OSRM's route `distance` is metres; every other distance in this app is
// kilometres. One place for the conversion so a call site never has to
// remember the divisor.
export function metersToKm(meters: number): number {
  return meters / 1000;
}

// '~22 min by car'. Input is seconds — OSRM's `duration` unit.
export function formatDuration(seconds: number): string {
  return `~${Math.round(seconds / 60)} min by car`;
}
